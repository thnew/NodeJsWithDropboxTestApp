// Middleware
var express = require('express');

var app = express();

// Server start
app.listen(80);

app.get('/', function(req, res) {
	res.send("Hello world!");
});