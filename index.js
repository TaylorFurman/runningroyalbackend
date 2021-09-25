require('dotenv').config()
// const hostname = '127.0.0.1';
var port = (process.env.PORT || 3700);

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
var session = require('express-session');
var morgan = require('morgan');


var passport = require('passport')
var GitHubStrategy = require('passport-github2').Strategy

var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

console.log('CONFIG', GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)

//Connect to database & save data to json file for front end to use for prop/state management
const pgp = require('pg-promise')();
const axios = require('axios');
const {dirname} = require('path');
const cors = require('cors');


var DATABASE_ID = process.env.DATABASE_ID;
var DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;
var DATABASE_HOST = process.env.DATABASE_HOST;
var DATABASE_USER = process.env.DATABASE_USER;

 const dbsettings = process.env.DATABASE_URL || ({
   database: DATABASE_ID,
   password: DATABASE_PASSWORD,
   host: DATABASE_HOST,
   user: DATABASE_USER
 })
 const db = pgp(dbsettings);

 passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: "http://127.0.0.1:3000/auth/github/callback"
},
(accessToken, refreshToken, profile, cb) => {
  console.log(chalk.blue(JSON.stringify(profile)));
  user = { ...profile };
  return cb(null, profile);
}));

//DONT FORGET () after cors EVER AGAIN 
var whitelist = ["https://keen-booth-986154.netlify.app", "http://localhost:3000"];
app.use(cors());

app.use(morgan('dev'));
app.use(express.urlencoded({extended:false}))
app.use(express.json())
app.use(session({
  secret: process.env.SECRET_KEY || 'dev',
  resave: true,
  saveUninitialized: false,
  cookie: {maxAge: 60000}
}));


// app.use(function (request, response, next) {
//   if (request.session.user) {
//     next();
//   } else if (request.path == '/login') {
//     next();
//   } else {
//     response.redirect('/login');
//   }
// });

app.get("/auth/github", passport.authenticate("github"));
app.get("/auth/github/callback",
    passport.authenticate("github"),
    (req, res) => {
        res.redirect("/profile");
    });

app.get("/auth/logout", (req, res) => {
  console.log("logging out!");
  user = {};
  res.redirect("/");
});




//sends data from frontend to database after finishing run <----------Database Information Below---------------->
app.post('/run_data', async (req,res)=>{
  res.send({stuff: true});
    await db.any(`INSERT INTO run_history VALUES(
      DEFAULT, 
      '${req.body.runId}',
      '${req.body.runnerId}',
      '${req.body.run_date}', 
      '${req.body.distance}', 
      '${req.body.position}',
      '${req.body.time_in_seconds}',
      '${req.body.time_in_minutes}',
      '${req.body.average_pace}', 
      '${req.body.latitude}',
      '${req.body.longitude}',
      '${req.body.polyline}')`)

  }
)



//Allows the Front End to access ALL data in the database (Run_History Table) <----------Database Information Below---------------->
app.get('/run_data', async (req,res)=>{
    await db.any(`SELECT * FROM run_history VALUES`)
    .then(run_history_data =>{
      res.json(run_history_data)
  }
)})


//socket io <--------------Socket Information Below------------------>
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});
  
var DATA = {
  rooms: [
    {name: "Room 1", runnersJoined: []}
  ]
};

io.on('connection', (socket) => {
  console.log('Runner connected', socket.id);
  socket.on('disconnect', () => console.log('user disconnected'));
  // socket.on('join', (room)=>{
  //     console.log(`Socket ${socket.id} joining ${room}`);
  // });
  socket.on('get_rooms', () => {
    socket.emit('rooms_data', DATA);
  });

  // socket.on('getLocation', (msg) => {
  //   DATA.rooms[msg.room][msg.runner].coords = msg.coords;
  //   io.emit('rooms_data', DATA);
  // });

  socket.on('addUserID', (msg) => {
    DATA.rooms[msg.roomID].runnersJoined.push(msg.runnerID);
    console.log('added userID on backend', JSON.stringify(DATA));
    io.emit('rooms_data', DATA);
  });

  socket.on('removeRunnersFromRun', (msg) => {
    DATA.rooms[msg.roomID].runnersJoined=[];
    console.log('remove runners', JSON.stringify(DATA));
    io.emit('rooms_data', DATA);
  });

});


server.listen(port, () => {
    console.log(`Server running at ${port}`);
});