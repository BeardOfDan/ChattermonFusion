const express = require('express');
const path = require('path');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const db = require('../database/db.js');
const bodyParser = require('body-parser');
const PokeApi = require('pokeapi');
const api = PokeApi.v1();
const Promise = require('bluebird');
const bcrypt = Promise.promisifyAll(require('bcrypt'));
const saltRounds = 10;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
const { calculateBaseHealth, calculateBaseStat, damageCalculation } = require('../game-logic.js');

const dist = path.join(__dirname, '/../client/dist');

app.use(bodyParser());
app.use(express.static(dist));

app.use(cookieParser());
app.use(session({
  secret: 'odajs2iqw9asjxzascatsas22',
  resave: false,
  saveUninitialized: false,
  // cookie: { secure: true },
}));
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV !== 'production') {
  const webpack = require('webpack');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const config = require('../webpack.config.js');
  const compiler = webpack(config);

  app.use(webpackHotMiddleware(compiler));
  app.use(webpackDevMiddleware(compiler, {
    noInfo: true,
    publicPath: config.output.publicPathdist
  }));
}

const games = {};

const createPokemon = (pokemon) => {
  const { name, baseHealth, baseAttack, baseDefense, frontSprite, backSprite, types } = pokemon;
  return {
    name,
    health: baseHealth,
    initialHealth: baseHealth,
    attack: baseAttack,
    defense: baseDefense,
    sprites: {front_default: frontSprite, back_default: backSprite},
    types
  }
}

const createPlayer = (player, number) => {
  const random = () => {
    return Math.ceil(Math.random() * 150)
  }
  return new Promise((resolve, reject) => {
    let pokemonCalls = [];
    for (let i=0; i < 3; i++) {
      pokemonCalls.push(db.Pokemon.findOne({ where: { id: random() } }))
    }
    Promise.all(pokemonCalls)
    .then(results => {
      console.log(results);
      let pokemon = []
      results.forEach(result => {
        pokemon.push(createPokemon(result));
      });
      resolve({
        player: number,
        name: player.name,
        pokemon
      })
    })
    .catch(err => reject(err));
  })
}

const createTurnlog = (game, turn, type) => {
  const player = game.playerTurn;
  const opponent = game.playerTurn === 'player1' ? 'player2' : 'player1'
  if (type === 'attack') {
    let turnlog = [{command: `${game[player].pokemon[0].name} attacked!`}];
    turn.logStatement !== '' ? turnlog.push({command: turn.logStatement}) : null;
    turnlog.push({command: `${game[opponent].pokemon[0].name} lost ${turn.damageToBeDone} HP`});
    return turnlog;
  } else if (type === 'switch') {
    let turnlog = [{command: `${game[player].pokemon[0].name} appears!`}];
    return turnlog;
  }
}


io.on('connection', (socket) => {

  // on join game, initialize game in games object if it does not exist
  socket.on('join game', (data) => {
    socket.join(data.gameid);
    if (!(data.gameid in games)) {
      createPlayer(data, 'player1')
      .then(player1 => {
        games[data.gameid] = {
          player1,
          player2: null,
          playerTurn: 'player1'
        }
        io.to(socket.id).emit('player', player1);
      })
      } else if (data.gameid in games && !games[data.gameid].player2) {
        createPlayer(data, 'player2')
        .then(player2 => {
          games[data.gameid].player2 = player2;
          console.log('finished creating player 2');
          io.to(socket.id).emit('player', player2);
          io.to(data.gameid).emit('ready', games[data.gameid]);
        })
      } else {
        io.to(socket.id).emit('gamefull', 'this game is full!');
      }
    })

  socket.on('chat message', (data) => {
    console.log('chat data:', data);
    io.to(data.gameid).emit('chat message', data)
  });

  socket.on('attack', (data) => {
    // find game to alter (gameid)
    const game = games[data.gameid];
    const player = game.playerTurn;
    const opponent = game.playerTurn === 'player1' ? 'player2' : 'player1'
    const turnResults = damageCalculation(game[player], game[opponent]);
    game[opponent].pokemon[0].health -= turnResults.damageToBeDone;
    const turnlog = createTurnlog(game, turnResults, 'attack');
    io.to(data.gameid).emit('attack processed', {
      basicAttackDialog: turnlog
    })
    if (game[opponent].pokemon[0].health <= 0) {
      io.to(data.gameid).emit('gameover', { name: game[player].name });
    } else {
      game.playerTurn = opponent;
      io.to(data.gameid).emit('turn move', game);
    }
  });

  socket.on('switch', data => {
    const game = games[data.gameid];
    const player = game.playerTurn;
    const opponent = game.playerTurn === 'player1' ? 'player2' : 'player1';
    game[player].pokemon.unshift(game[player].pokemon.splice(data.index, 1)[0]);
    const turnlog = createTurnlog(game, null, 'switch');
    game.playerTurn = opponent;
    io.to(data.gameid).emit('attack processed', {
      basicAttackDialog: turnlog
    });
    io.to(data.gameid).emit('turn move', game);
  })

});

app.post('/login', (req, resp) => {
  console.log('post request on /login');
  const username = req.body.username;
  const password = req.body.password;


  console.log('username', username);
  console.log('password', password);
  db.Users
  .findOne({where: { username } })
  .then(user => {
    console.log('SERVER: /login found user =', user);
    // finds user
    // not found => end resp
    // found => compare passwords
    // don't match => end resp
    // login
    if (!user) {
      console.log("redirecting to signup");
      resp.writeHead(201, {'Content-Type': 'text/plain'});
      resp.end('Username Not Found');
    }
    else {
      const hash = user.dataValues.password;
      return bcrypt.compare(password, hash)
    }
  })
  .then(passwordsMatch => {
    if (!passwordsMatch) {
      resp.writeHead(201, {'Content-Type': 'text/plain'});
      resp.end('Passwords Do Not Match');
    }
    else {
      req.session.username = username;
      req.session.loggedIn = true;
      resp.redirect('/welcome');
    }
  })
})

app.post('/signup', (req, resp) => {
  console.log('post request on /signup');
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  bcrypt.hash(password, saltRounds)
    .then(hash => db.saveUser(username, hash, email))
    .then(newuser => {
      console.log(newuser);
      if (newuser.dataValues) {
        req.login({ user_id: newuser.id }, err => {
            if (err) throw err;
            console.log("NEW USER ID:", newuser.id);
            resp.writeHead(201, {'Content-Type': 'text/plain'});
            resp.end('User Created');
          });
      }
      else if (newuser.match('Username Already Exists')) {
        resp.writeHead(201, {'Content-Type': 'text/plain'});
        resp.end('Username Already Exists');
      }
      else if (newuser.match('Email Already Exists')) {
        resp.writeHead(201, {'Content-Type': 'text/plain'});
        resp.end('Email Already Exists');
      }
    })
    .catch(err => {
      throw new Error(err)
    });
})
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.get('/user', (req, resp) => {
  console.log('on /isloggedin')
  console.log(req.session);
  resp.writeHead(200, {"Content-Type": "application/json"});
  resp.end(JSON.stringify({
    username: req.session.username,
    loggedIn: req.session.loggedIn
  }));
})

app.get('/logout', (req, resp) => {
  req.session.destroy(err => {
    if (err) throw err;
    console.log("LOGGING OUT")
    resp.redirect('/login'); //Inside a callback… bulletproof!
  });
});
// a catch-all route for BrowserRouter - enables direct linking to this point.
app.get('/*', (req, resp) => {
    resp.sendFile(dist + '/index.html');
});


// The following is an example case of using the pokeapi module
// REF: https://www.npmjs.com/package/pokeapi

// api.get('pokemon', 1).then(function(bulbasaur) {
//     console.log("Here's Bulbasaur:", bulbasaur);
//   api.get(bulbasaur.moves).then(function(moves) {
//       console.log("Full move list:" + moves);
//     })
// }, function(err) {
//     console.log('ERROR', err);
// });


var port = process.env.PORT || 3000;
http.listen(port, function(){
  console.log('listening on *:' + port);
});

module.exports = app;
