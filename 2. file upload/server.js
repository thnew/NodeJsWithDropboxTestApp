﻿// Middleware
var express = require('express');

// Sessions
var sessionstore = require('sessionstore');
var expressSession = require('express-session');

/*/ Access Codes for your app
https://www.dropbox.com/developers/apps > your app > Copy "App key" and "Secret Key"
//*/
var APP_KEY = "gfe7vaazvntivhe";
var APP_SECRET = "v7x2vkozelzl36q";

// Instantiate the server
var app = express();

// Configure (change to own secret string!)
var sessionSecret = "6NinwLOUVxnkjXPiXVK98RUPMfBrQfsu";

app.use(expressSession({
	secret:	sessionSecret,
	store:	sessionstore.createSessionStore()
}));

// Start the server at port 80
app.listen(80);

// listen to http://localhost/
app.get('/', function (req, res) {
	// Respond with "Hello World!"
	res.send("Hello World!");
});

var crypto = require('crypto');
var __redirectUrl;

// listen to http://localhost/login
app.get('/login', function(req, res) {
	// Build the Dropbox URL the user should be redirected to
	var url = "https://www.dropbox.com/1/oauth2/authorize";
	
	// The id of our Dropbox app
	url += "?client_id=" + APP_KEY;
	
	// Type of response Dropbox will give
	url += "&response_type=code";
	
	// Append CSRF Token to prevent CSRF attacks
	var csrfToken = crypto.randomBytes(18).toString('base64').replace(/\//g, '-')
		.replace(/\+/g, '_');
	
	// remember the token, will be required later again
	req.session.csrf = csrfToken;
	
	url += "&state=" + csrfToken;
	
	// The URL where Dropbox will redirect the user back to.
	__redirectUrl = req.protocol + "://" + req.headers.host + app.path() + "/success";
	url += "&redirect_uri=" + __redirectUrl;
	
	// Redirect the user to Dropbox
	res.redirect(url);
});

// To request informations from Dropbox
var request = require('request');

// listen to http://localhost/success
app.get('/success', function (req, res) {
	if(req.query.error)
		return res.send('ERROR ' + req.query.error + ': ' + req.query.error_description);

	if(req.query.state !== req.session.csrf)
		return res.status(401).send("CSRF token mismatch");
	
	var parameters = {
		form: {
			code: 			req.query.code,
			grant_type:		'authorization_code',
			redirect_uri:	__redirectUrl
		},
		auth: {
			user:	APP_KEY,
			pass:	APP_SECRET
		}
	};
	
	request.post('https://api.dropbox.com/1/oauth2/token', parameters,
		function(error, response, body){
			_receiveToken(error, response, body, req, res);
		}
	);
});

// receive and and handle token repsonse from Dropbox
function _receiveToken(error, response, body, req, res) {
	// Parse the response body. Text to object
	var data = JSON.parse(body);
	
	// Handle errors
	if(data.error) return res.send('ERROR: ' + data.error);
	
	// Read the access token and remember it for later
	req.session.token = data.access_token;
	
	// Test request to check if token works
	var parameters = {
		headers: {
			Authorization: 'Bearer ' + req.session.token
		}
	};
	
	request.post('https://api.dropbox.com/1/account/info', parameters, 
		function(error, response, body){
			_receiveAccountInfo(error, response, body, res);
		});
};

function _receiveAccountInfo(error, response, body, res) {
	// Parse the response body. Text to object
	var data = JSON.parse(body);
	
	res.send('Logged in successfully as ' + data.display_name);
};

var formidable = require('formidable');

// Deliver simplest possible interface to choose a file to upload
app.get('/upload', function (req, res) {
	var html = '<form action="upload" method="POST" enctype="multipart/form-data">';
	html += '<input name="uploadMe" type="file" /><input type="submit">';
	html += '</form>';

	res.send(html);
});

// Receive files and upload them to Dropbox
app.post('/upload', function (req, res) {
	if (req.query.error) return res.send('ERROR: ' + req.query.error + ': ' + req.query.error_description);

	var form = new formidable.IncomingForm();

	form.parse(req, function (error, fields, files) {
		_parsedFileRequest(error, fields, files, req, res);
	});
});

var fs = require('fs');

function _parsedFileRequest(error, fields, files, req, res) {
	if (error) return res.send('ERROR: ' + error);

	// Check if files available
	if (files.length < 0) throw "No file given!";
	
	// Workaround to get the first file
	var file;
	for (var f in files)
	{
		file = files[f];
		break;
	}
	
	fs.readFile(file.path, function(error, data) {
		_uploadFileReaded(error, data, file.name, req, res);
	});
};

function _uploadFileReaded(error, data, filename, req, res) {
	if (req.error) res.send("ERROR: " + req.error);
	
	fileupload(req.session.token, data, filename, function (req) {
		if (req.error) res.send("ERROR: " + req.error);
		else res.send("Uploaded!");
	});
};

function fileupload(token, content, filename, callback){
	var options = {
		body:	content,
		headers: {
			Authorization:	'Bearer ' + token,
			'Content-Type':	'application/octet-stream'
		}
	};
	
	var url = 'https://api-content.dropbox.com/1/files_put/auto/' + filename;
	
	// Send upload request to dropbox
	request.put(url, options, function(error, httpResponse, bodymsg) {
		_uploadCallback(error, httpResponse, bodymsg, callback);
	});
};

function _uploadCallback(error, httpResponse, bodymsg, callback) {
	var resp = JSON.parse(bodymsg);
	error = error || resp.error;
	
	if(error)
	{
		callback({ error: error });
	}
	else
	{
		callback({});
	}
};