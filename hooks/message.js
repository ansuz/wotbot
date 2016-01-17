console.log("Got a message!");
console.log(args);

/*

>message
Got a message!
{ from: 'ansuz',
  to: '#bots',
  message: 
   { prefix: 'ansuz!~ansuz@fc6a:30c9:53a1:2c6b:ccbf:1261:2aef:45d3',
     nick: 'ansuz',
     user: '~ansuz',
     host: 'fc6a:30c9:53a1:2c6b:ccbf:1261:2aef:45d3',
     command: 'PRIVMSG',
     rawCommand: 'PRIVMSG',
     commandType: 'normal',
     args: [ '#bots', 'hi NSA' ] } }

*/

var from = args.from,
    to = args.to,
    msg = args.message,
    host = msg.host,
    content = msg.args[1];

// .getAllTrusted(fromNick)
// .getTrust(fromNick, toNick)
// .getValue(nick)
// .kick(nick);

var commands = /^\s*\.(itrust|getAllTrusted|getTrust|getValue|kick)/;

if (commands.test(content)) {
    var tokens = content.trim().slice(1).split(/\s+/);

    var line = {
        args: tokens,
        from: host,
        channel: to,
        time: new Date.getTime(),
    };

    console.log("Got a message");
    console.log(typeof global.logStream.write);

    if (global.logStream && global.logStream.write) {

        global.logStream.write(JSON.stringify(line)+"\n");
        bot.say(to, "k");
    } else {
        bot.say("Couldn't write to log");
    }

} else {
    // do nothing...

}
