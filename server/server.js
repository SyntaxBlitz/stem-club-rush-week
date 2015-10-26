var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(2324);	// I'm a teapot

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('/admin', function (req, res) {
	res.sendFile(__dirname + '/admin.html');
});

var DudSocket = function () {
	return {
		emit: function () {},
		dud: true
	};
};

var lastCode = 0;

var gameClients = [];
var adminClient = DudSocket();
var rpi = DudSocket();

var completionsToWin = -1;

var started = false;

var redPlayer = null;
var bluePlayer = null;

var redWater = 0;	// in millilitres!
var blueWater = 0;

var MAX_WATER = 438;	// 2.0625 in by 8 in

io.on('connection', function (socket) {
	socket.on('create client', function (data) {
		var socketCode = ++lastCode;

		gameClients.push({
			socket: socket,
			uniqueCode: socketCode
		});

		socket.emit('unique code', {code: socketCode});
	});

	socket.on('add some water', function (data) {
		if (socket === redPlayer) {
			redWater += MAX_WATER / completionsToWin;
		} else if (socket === bluePlayer) {
			blueWater += MAX_WATER / completionsToWin;
		} else {
			return;
		}

		adminClient.emit('water state update', {redWater: redWater, blueWater: blueWater});
		console.log('add water');
		rpi.emit('add water', {player: (socket === redPlayer? 'red' : 'blue')});

		var winner = null;
		if (Math.ceil(redWater) >= MAX_WATER) winner = 'red';
		if (Math.ceil(blueWater) >= MAX_WATER) winner = 'blue';

		if (winner !== null) {
			adminClient.emit('game is over!', {winner: winner});
			redPlayer.emit('game is over!', {winner: winner});
			bluePlayer.emit('game is over!', {winner: winner});

			started = false;
			redWater = 0;
			blueWater = 0;
			redPlayer = null;
			bluePlayer = null;
		}
	});

	socket.on('admin auth', function (data) {
		console.log('auth attempt');
		if (data.password === 'stem-rush-thox') {
			console.log('auth success');
			adminClient = socket;
			var rpiConnected = rpi.dud === undefined;
			adminClient.emit('authed successfully :)', {rpiConnected: rpiConnected});
		}
	});

	socket.on('rpi auth', function (data) {
		console.log('rpi connected?');
		if (data.password === 'I AM A RASPBERRY PI') {
			console.log('rpi connected!');
			rpi = socket;
			rpi.emit('authed :D');
			adminClient.emit('rpi connected');
		}
	});

	socket.on('admin game start', function (data) {
		if (socket !== adminClient)
			return;
		if (started)
			return;
		if (completionsToWin === -1)
			return;
		if (rpi.dud)
			return;

		var redPlayerMaybe = null;
		var bluePlayerMaybe = null;

		for (var i = 0; i < gameClients.length; i++) {
			if (gameClients[i].uniqueCode === data.redPlayer) {
				redPlayerMaybe = gameClients[i];
			}
			if (gameClients[i].uniqueCode === data.bluePlayer) {
				bluePlayerMaybe = gameClients[i];
			}
		}

		if (redPlayerMaybe !== null && bluePlayerMaybe !== null) {
			console.log('game start');
			adminClient.emit('start game!');
			redPlayerMaybe.socket.emit('start game!', {player: 'red'});
			bluePlayerMaybe.socket.emit('start game!', {player: 'blue'});

			redPlayer = redPlayerMaybe.socket;
			bluePlayer = bluePlayerMaybe.socket;

			started = true;
		}
	});

	socket.on('admin change completions to win', function (data) {
		if (socket !== adminClient)
			return;

		if (!started) {
			completionsToWin = data.completionsToWin;
			adminClient.emit('changed completions to win', {completionsToWin: completionsToWin});
		} else {
			adminClient.emit('can\'t change completions to win midgame');
		}
	});

	socket.on('admin e-stop', function (data) {
		if (socket !== adminClient)
			return;
		if (!started)
			return;

		rpi.emit('EMERGENCY STOP JESUS SHUT IT ALL DOWN');

		io.emit('game is over!', {winner: null});	// send to ALL clients, in case one of them is stuck
		
		started = false;
		redWater = 0;
		blueWater = 0;
		redPlayer = null;
		bluePlayer = null;
	});

	socket.on('disconnect', function () {
		if (socket === adminClient) {
			adminClient = DudSocket();
		} else if (socket === rpi) {
			console.log('rpi disconnected');
			adminClient.emit('rpi disconnected');
			rpi = DudSocket();
		} else {
			for (var i = 0; i < gameClients.length; i++) {
				if (gameClients[i].socket === socket) {
					gameClients.splice(i, 1);
					break;
				}
			}
		}
		console.log(gameClients);
	});
});
