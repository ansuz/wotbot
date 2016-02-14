/* globals args, bot, state */

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

var ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
var now = function () { return new Date().getTime(); };

var from = args.from,
    to = args.to,
    msg = args.message,
    host = msg.host,
    content = msg.args[1];

// .getAllTrusted(fromNick)
// .getTrust(fromNick, toNick)
// .getValue(nick)
// .kick(nick);

var validPercent = function (token) {
    if (Number(token).toString() !== token || token === "NaN") { return false; }
    var num = Number(token);
    return (typeof (num) === 'number' &&
        num % 1 === 0 &&
        num > -1 &&
        num < 101);
};

var nick2Host = function (nick, cb) {
    // cb(/*ERROR*/, /*result*/);
    if (nick.indexOf(':') !== -1) {
        if (typeof(state.karmaByAddr[nick]) !== 'undefined') {
            cb(null, nick);
            return;
        }
    }
    bot.whois(nick, function (message) {
        if (message && message.host) {
            cb(null, message.host);
            console.log(message);
        } else {
            cb("could not find a host for ["+nick+"]", null);
            console.log("DEBUG");
            console.log(message);
        }
    });
};

var validItrust = function (tokens, cb) {
    // itrust nick/host percent

    // there should be three tokens
    if (tokens.length !== 3) {
        // complain and return
        cb("try `.itrust nick <int 0-100>`", null);
        return;
    } else if (!validPercent(tokens[2])) {
        // complain and return
        cb("your value should be an integer between 0 (no trust) and 100 (complete trust)", null);
        return;
    } else {
        // try to get the host
        nick2Host(tokens[1], cb);
    }
};


(function () {
    if (content.indexOf(state.trigger) !== 0) { return; }

    var tokens = content.trim().slice(1).split(/\s+/);
    if (to === bot.nick) { to = from; }
    var line = {
        args: tokens,
        from: host,
        channel: to,
        time: new Date().getTime(),
    };

    switch (tokens[0]) {
        case 'itrust': (function () {
            if (tokens.length < 2 || tokens.length > 3) {
                bot.say(to, from + ": try `.itrust nick <int 0-100>` or `.itrust nick` to check");
                return;
            }
            if (from === tokens[1]) {
                bot.say(to, from + ": yeah yeah everybody trusts themselves, old news");
                return;
            }
            nick2Host(tokens[1], function (e, out) {
                if (e) {
                    bot.say(to, from + ": " + e);
                    return;
                }
                if (tokens.length === 3) {
                    if (!validPercent(tokens[2])) {
                        bot.say(to, from + ": your value should be an integer between 0 " +
                            "(no trust) and 100 (complete trust)");
                        return;
                    }
                    // no errors, write to log
                    state.logToDb({
                        command: 'itrust',
                        src: line.from,
                        srcNick: from,
                        dest: out,
                        destNick: tokens[1],
                        trust: parseInt(tokens[2]),
                        time: new Date().getTime()
                    }, function (err) {
                        if (err) {
                            bot.say(to, from + ': ' + err);
                        } else {
                            bot.say(to, (from + " trusts " + out + " " + tokens[2] + "%"));
                        }
                    });
                } else {
                    var fTrust = state.trustBySrcDestPair[line.from + '|' + out] || 0;
                    var rTrust = state.trustBySrcDestPair[out + '|' + line.from] || 0;
                    bot.say(to, (from + " trusts " + out + " " + fTrust + "% and is trusted " +
                        rTrust + "%"));
                }
            });

        }());break;

        case 'karma': (function () {
            if (tokens.length !== 2) {
                bot.say(to, from + ': try .karma <nick>');
                return;
            }
            nick2Host(tokens[1], function (err, addr) {
                if (err) { bot.say(to, from + ': ' + err); return; }
                state.whenSynced(function () {
                    var karma = Math.floor((state.karmaByAddr[addr] || 0) * 1000) / 1000;
                    bot.say(to, from + ': ' + addr + ' has ' + karma + ' karma');
                });
            });
        }());break;

        case 'error': (function () {
            var error = state.error || "none";
            state.error = undefined;
            bot.say(to, from + ': ' + error);
        }());break;

        case 'referendum': (function () {
            if (tokens.length < 4) {
                bot.say(to, from + ': try .referendum <url of description> <opt1> <opt2> [<optX>]');
                return;
            }
            var num = state.referendums.length;
            tokens.pop();
            var url = tokens.pop();
            state.logToDb({
                command: 'referendum',
                src: line.from,
                srcNick: from,
                url: url,
                options: tokens,
                num: num,
                time: new Date().getTime()
            }, function (err) {
                if (err) {
                    bot.say(to, from + ': ' + err);
                } else {
                    bot.say(to, (from + " created referendum r" + num + " (" + tokens[1] + ")"));
                }
            });
        }());break;

        case 'vote': (function () {
            if (tokens.length < 3 || !/^[rR][0-9]+$/.test(tokens[1])) {
                bot.say(to, from + ': try .vote r<number> <choice1> [<choice2> [<choiceX>]]');
                return;
            }
            var ref = state.referendums[Number(tokens[1].substring(1))];
            if (!ref) {
                bot.say(to, from + ': referendum ' + tokens[1] + ' not found');
                return;
            }
            if (ref.time < (now() - ONE_WEEK_MS)) {
                bot.say(to, from + ': voting on referendum ' + tokens[1] + ' has closed');
                return;
            }
            tokens.pop();
            var url = tokens.pop();
            state.logToDb({
                command: 'referendum',
                src: line.from,
                srcNick: from,
                url: url,
                options: tokens,
                time: now()
            }, function (err) {
                if (err) {
                    bot.say(to, from + ': ' + err);
                } else {
                    bot.say(to, from + ': Vote registered');
                }
            });
        }());break;

        default:
            break;
    }
}());
