const { Client, Intents } = require("discord.js");

// Discord.js v13 requires us to pass Intents to specify what events the bot should receive
// Just give every non-privileged intent for now.
const botIntents = new Intents(32509);
const client = new Client({ intents: botIntents });
const fs = require("fs");

// This loop reads the /events/ folder and attaches each event file to the appropriate event.
fs.readdir("./events/", (err, files) => {
    if (err) return console.error(err);
    files.forEach(file => {
        let eventFunction = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        // super-secret recipe to call events with all their proper arguments *after* the `client` var.
        client.on(eventName, (...args) => eventFunction.run(client, ...args));
    });
});

client.on("messageCreate", message => {
    if (message.author.bot) return;
    // Prevent crashes with commands that send messages in channels where bot doesn't have permissions
    if (!message.guild.me.permissionsIn(message.channel).has("SEND_MESSAGES") ) return;

    // Reply when mentioned
    if (message.mentions.has(client.user)) {
        message.channel.send({content: "No memes.", reply: { messageReference: message }});  
	}

    // Substitute twitter links that contain videos with fxtwitter
    if (message.content.includes("https://twitter.com/")) {
        let twitFix = require(`./plugins/twitfix.js`);
        twitFix.run(client, message);
        return;
	}
});

client.login(process.env.BOT_TOKEN);
