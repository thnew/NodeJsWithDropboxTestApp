var http = require('http');
var express = require('express');
var crypto = require('crypto');
var url = require('url');
var cookieParser = require('cookie-parser');
var request = require('request');
var sessionstore = require('sessionstore');
var expressSession = require('express-session');
var fs = require('fs');

var APP_KEY = "dj6hwebqhfp5vw6";
var APP_SECRET = "ua9ntt4be18b6uy";

function generateRedirectURI(req) {
	return url.format({
		protocol: req.protocol,
		host: req.headers.host,
		pathname: app.path() + '/success'
	});
}

function generateCSRFToken() {
	return crypto.randomBytes(18).toString('base64')
		.replace(/\//g, '-').replace(/\+/g, '_');
}

var app = express();

// Configure
var cookieSecret = "6NinwLOUVxnkjXPiXVK98RUPMfBrQfsu";
app.use(cookieParser(cookieSecret));

app.use(expressSession({
	secret:	cookieSecret,
	store:	sessionstore.createSessionStore()
}));

// Server start
app.listen(80);

app.get('/', function (req, res) {
	var csrfToken = generateCSRFToken();
	res.cookie('csrf', csrfToken);
	res.redirect(url.format({
		protocol: 'https',
		hostname: 'www.dropbox.com',
		pathname: '1/oauth2/authorize',
		query: {
			client_id: APP_KEY,//App key of dropbox api
			response_type: 'code',
			state: csrfToken,
			redirect_uri: generateRedirectURI(req)
		}
	}));
});

app.get('/success', function (req, res) {
	if (req.query.error) {
		return res.send('ERROR ' + req.query.error + ': ' + req.query.error_description);
	}

	if (req.query.state !== req.cookies.csrf) {
		return res.status(401).send(
			'CSRF token mismatch, possible cross-site request forgery attempt.'
		);
	}

	request.post('https://api.dropbox.com/1/oauth2/token', {
			form: {
				code: req.query.code,
				grant_type: 'authorization_code',
				redirect_uri: generateRedirectURI(req)
			},
			auth: {
				user: APP_KEY,
				pass: APP_SECRET
			}
		}, function (error, response, body) {
			var data = JSON.parse(body);
			if (data.error) {
				return res.send('ERROR: ' + data.error);
			}

			var token = data.access_token;
			req.session.token = data.access_token;
			
			request.post('https://api.dropbox.com/1/account/info', {
					headers: { Authorization: 'Bearer ' + token }
				}, function (error, response, body) {
					res.send('Logged in successfully as ' + JSON.parse(body).display_name + '. <a href="/uploadfile">upload file</a>');
				}
			);
		});
	
	//res.send("Connected");
});

app.get('/uploadfile', function (req, res) {
	var serverpath = "bulb.png";//file to be save at what path in server
	var localpath = "C:/Users/Thomas/Pictures/bulb.png";//path of the file which is to be uploaded
	if (req.query.error) {
		return res.send('ERROR ' + req.query.error + ': ' + req.query.error_description);
	}
	fs.readFile(localpath,'utf8', function read(err, data) {
			if (err) {
				throw err;
			}
			content = data;
			console.log(content); 
			fileupload(req.session.token, content, serverpath, function(){
				res.send("Uploaded!");
			});
		});
});

function fileupload(token, content, path, callback){
	request.put('https://api-content.dropbox.com/1/files_put/auto/' + path, {
			body:	content,
			headers: {
				Authorization:	'Bearer ' + token , 
				'Content-Type':	'application/octet-stream'
			}
		},
		function optionalCallback (err, httpResponse, bodymsg) {
			if (err) {
				console.log(err);
			}
			else
			{ 
				console.log(bodymsg);
				
				callback();
			}
		}
	);
}