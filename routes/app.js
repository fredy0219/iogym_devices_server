var express = require("express")
var app = express();

app.get('/', function(req, res){
	res.send('Hello World!');
});

app.listen(53088, function(){
	console.log('Iogym Device Server : Welcome!');
});
