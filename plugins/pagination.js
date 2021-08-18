// Base code from https://github.com/ryzyx/discordjs-button-pagination
//
const {
  MessageActionRow,
  Message,
  MessageEmbed,
  MessageButton,
} = require("discord.js");

/**
 * Creates a pagination embed
 * @param {Message} msg
 * @param {MessageEmbed[]} pages
 * @param {boolean} authorOnly
 * @param {MessageButton[]} buttonList
 * @param {number} timeout
 * @returns
 */
const paginationEmbed = async (msg, pages, authorOnly = false, timeout = 120000, defaultPage = 0, buttonList = null) => {
  if (!msg && !msg.channel) throw new Error("Channel is inaccessible.");
  if (!pages) throw new Error("Pages are not given.");
  if (!buttonList) { // Use default buttons
    const button1 = new MessageButton()
                    .setCustomId('previousbtn')
                    .setLabel('Previous')
                    .setStyle('PRIMARY');

    const button2 = new MessageButton()
                    .setCustomId('nextbtn')
                    .setLabel('Next')
                    .setStyle('PRIMARY');
    buttonList = [
        button1,
        button2
    ]
  }
  if (buttonList[0].style === "LINK" || buttonList[1].style === "LINK")
    throw new Error(
      "Link buttons are not supported with discordjs-button-pagination"
    );
  if (buttonList.length !== 2) throw new Error("Need two buttons.");

  let page = defaultPage;

  const row = new MessageActionRow().addComponents(buttonList);
  const curPage = await msg.channel.send({
    embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
    components: [row],
    reply: { messageReference: msg },
    allowedMentions: {repliedUser: false},
  });
  
  const filter = (i) =>
    ( !authorOnly || i.user.id === msg.author.id ) && // If we set interaction for authorOnly, check id
    ( i.customId === buttonList[0].customId || i.customId === buttonList[1].customId );

  const collector = await curPage.createMessageComponentCollector({
    filter,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    switch (i.customId) {
      case buttonList[0].customId:
        page = page > 0 ? --page : pages.length - 1;
        break;
      case buttonList[1].customId:
        page = page + 1 < pages.length ? ++page : 0;
        break;
      default:
        break;
    }
    await i.deferUpdate();
    await i.editReply({
      embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
      components: [row],
    });
    collector.resetTimer();
  });

  collector.on("end", () => {
    if (!curPage.deleted) {
      const disabledRow = new MessageActionRow().addComponents(
        buttonList[0].setDisabled(true),
        buttonList[1].setDisabled(true)
      );
      curPage.edit({
        embeds: [pages[page].setFooter(`Page ${page + 1} / ${pages.length}`)],
        components: [disabledRow],
      });
    }
  });

  return curPage;
};
module.exports = paginationEmbed;