// Middleware
var express = require('express');

// Sessions
var sessionstore = require('sessionstore');
var expressSession = require('express-session');

var crypto = require('crypto');
var urlFormatter = require('url');

// To request informations from Dropbox
var request = require('request');

/*/ Access Codes for your app
https://www.dropbox.com/developers/apps > your app > Copy "App key" and "Secret Key"
//*/
var APP_KEY = "t6v0mfgjkna96ii";
var APP_SECRET = "kicdy25nz74hp83";

// Just to be quick. Later save this this token in a database!
var __csrf = "";

// Takes a request object and builds the redirect url for Dropbox
function generateRedirectURI(req) {
	var url = req.protocol + "://" + req.headers.host + app.path() + "/success";
	
	return url;
}

function generateCSRFToken() {
	return crypto.randomBytes(18).toString('base64').replace(/\//g, '-').replace(/\+/g, '_');
}

var app = express();

// Server start
app.listen(80);

app.get('/', function(req, res) {
	// Generate and remember csrf token
	var csrfToken = generateCSRFToken();
	__csrf = csrfToken;
	
	var url = "https://www.dropbox.com/1/oauth2/authorize";
	url += "?client_id=" + APP_KEY;
	url += "&response_type=code";
	url += "&state=" + csrfToken;
	url += "&redirect_uri=" + generateRedirectURI(req);
	
	res.redirect(url);
});

app.get('/success', function(req, res) {
	if(req.query.error)
	{
		return res.send('ERROR ' + req.query.error + ': ' + req.query.error_description);
	}

	if(req.query.state !== __csrf)
	{
		return res.status(401).send('CSRF token mismatch, possible attempt.');
	}
	
	var parameters = {
		form:
		{
			code: req.query.code,
			grant_type: 'authorization_code',
			redirect_uri: generateRedirectURI(req)
		},
		auth:
		{
			user: APP_KEY,
			pass: APP_SECRET
		}
	};
	
	var callback = function(error, response, body) {
		var data = JSON.parse(body);
		if(data.error) {
			return res.send('ERROR: ' + data.error);
		}

		var token = data.access_token;
		req.session.token = data.access_token;
		
		request.post('https://api.dropbox.com/1/account/info', {
				headers: { Authorization: 'Bearer ' + token }
			}, function(error, response, body) {
				res.send('Logged in successfully as ' + JSON.parse(body).display_name);
			}
		);
	};
	
	request.post('https://api.dropbox.com/1/oauth2/token', parameters, callback);
});