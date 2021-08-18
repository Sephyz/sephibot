exports.run = (client, message, pool, args) => {
const Discord = require('discord.js');

const embed = new Discord.MessageEmbed()
  .setTitle("List of Bot commands")
  .setColor(0x00AE86)
  .setThumbnail("https://cdn.discordapp.com/avatars/876998783660068864/1dc25a8189b02de637821cafe82bf1a7.png")
  .addField("**!games help**","List of commands that call the Internet Game Database API")
  .addField("**!kitsu help**","List of commands that call the Kitsu API (Anime/Manga search)")
  .addField("**!help**","You just used this one...")

message.channel.send({embeds: [embed]}).catch(console.error);
}
