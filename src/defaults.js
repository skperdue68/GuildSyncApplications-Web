// Optional starter templates from GuildSyncApplications 1.4.3. Never inserted into imported files automatically.
export const starterTemplates = {
  "message": [
    {
      "title": "Classic Godfather",
      "message": "The Family has made {name} an offer they couldn't refuse! Please welcome our newest member to the Alphabet Mafia.  Check out our Discord, listed on the guild's \"G\" tab by default, for events, guild info, and all the queer organized crime you can handle."
    },
    {
      "title": "Getting made",
      "message": "{name} just got MADE! Please welcome the newest member of the Alphabet Mafia Family. Your first assignment: check out our Discord, listed on the guild's \"G\" tab by default, for upcoming events, guild info, and to meet your fellow queer partners in crime."
    },
    {
      "title": "Maximum Camp",
      "message": "Someone alert the authorities: the Alphabet Mafia is recruiting again! Please welcome our newest fabulous accomplice, {name}! Check out our Discord on the guild's \"G\" tab by default for events, information, questionable associates, and further instructions from the Family."
    },
    {
      "title": "The Family Business",
      "message": "Family business! Please welcome {name}, our newest associate in the Alphabet Mafia.  You'll find our Discord listed on the guild's \"G\" tab by default. Stop by for events, guild information, and to meet the rest of your new queer crime Family. Remember: no talking to the guards!"
    },
    {
      "title": "Queer Mafi",
      "message": "The Alphabet Mafia grows stronger! Everyone welcome our newest partner in queer organized crime, {name}. Your initiation begins with our Discord, listed on the guild's \"G\" tab by default. You'll find upcoming events, guild information, and the rest of your new chosen Family waiting inside."
    }
  ],
  "email": [
    {
      "title": "Classic Godfather",
      "subject": "Welcome to the Family {name}",
      "body": "Dear {name},\n\nWe've been watching you. Don't worry, it's less threatening than it sounds.\n\nYou've been made an offer you couldn't refuse, so welcome to the Alphabet Mafia! Our slightly disorganized organized-crime Family specializes in dungeons, trials, questionable fashion and queer shenanigans across Tamriel.\n\nYour initiation is simple: have fun, be kind, and remember that snitches get stitches. Unless you're snitching about an adorable pet. Then pictures are required.\n\nWelcome to the Family!\n\n--The Alphabet Mafia Consiglieri\n\nP.S. Join us: discord.gg/alphabetmafia\nPlease set your server name to your ESO Account name. Pet pictures are \"technically\" optional."
    },
    {
      "title": "You've been made",
      "subject": "Congratulations - You've Been Made {name}",
      "body": "Dear {name},\n\nCongratulations. You've been MADE.\n\nYou are officially a member of the Alphabet Mafia Family! Your duties may include dungeons, trials, antiquities, fashion crimes, decorating empty houses, and other queer mischief across Tamriel.\n\nFamily rules are simple: be kind, help when you can, ask when you need it, and join the fun. Mention a pet and photographic evidence may be demanded.\n\nMay your loot be plentiful, your wipes hilarious, and your fashion crimes fabulous!\n\n--The Alphabet Mafia Consiglieri\n\nP.S. Report to headquarters: discord.gg/alphabetmafia\nPlease set your server name to match your ESO Account name. It helps us identify our accomplices."
    },
    {
      "title": "Maximum Camp",
      "subject": "Welcome to the Alphabet Mafia {name}",
      "body": "Dear {name},\n\nDarling, you're in.\n\nThe votes were counted, the wigs secured, somebody dramatically kissed a ring, and the Family has spoken. Welcome to the Alphabet Mafia!\n\nWe specialize in being queer, fabulous, occasionally competent, and causing trouble across Tamriel. Expect dungeons, trials, housing, questionable jokes, helpful advice, and far too much time discussing outfits.\n\nJoin the fun, ask for help, and remember: mention a pet and pictures are required. We don't make the rules. Actually, we do.\n\n--The Alphabet Mafia Consiglieri\n\nP.S. Join us: discord.gg/alphabetmafia\nPlease set your server name to your ESO Account name so we can identify our accomplices."
    },
    {
      "title": "The Initiation",
      "subject": "Your Alphabet Mafia Initiation {name}",
      "body": "Dear {name},\n\nYour application has been reviewed by several shadowy figures in an undisclosed back room. After intense deliberation, dramatic lighting, and at least one completely unnecessary monologue, a decision has been reached.\n\nYou're in.\n\nWelcome to the Alphabet Mafia!\n\nYou are now part of a proud criminal tradition of being queer, causing trouble across Tamriel, collecting entirely too many furnishings, standing around talking when we were supposed to start the dungeon ten minutes ago, and looking fabulous while doing it.\n\nYour initiation is relatively painless. Say hello. Join some events. Ask for help when you need it. Help another Family member when you can. Be yourself. Have fun.\n\nThere is no blood oath.\n\nWe considered one, but the paperwork was ridiculous.\n\nThere is, however, a pet tax. If you have pets, we expect pictures. Failure to comply may result in someone asking you again.\n\nWelcome to the Family, {name}. Your alibi starts now.\n\n--The Alphabet Mafia Consiglieri\n\nP.S. Join the rest of the Family at discord.gg/alphabetmafia and please change your server name to match your ESO Account name. We run a respectable criminal organization and need to know who everyone is."
    },
    {
      "title": "The Family Handbook",
      "subject": "A Message From the Family",
      "body": "Dear {name},\n\nWelcome to the Alphabet Mafia. By opening this letter, you've accepted an offer you couldn't refuse. Don't worry, the benefits are excellent.\n\nOur queer criminal network specializes in dungeons, trials, housing, terrible jokes, fabulous outfits, and helping Family survive Tamriel.\n\nThe rules: be kind, ask for help, help others when you can, and have fun. Mention an adorable pet and you've surrendered your right to withhold pictures.\n\n--The Alphabet Mafia Consiglieri\n\nP.S. Join us: discord.gg/alphabetmafia\nPlease set your server name to your ESO Account name.\n\nP.P.S. Seriously. We weren't joking about the pet pictures."
    }
  ]
};
// Catalog identities stay stable across accounts and edits; addon numeric IDs remain local.
for(const kind of ['message','email'])starterTemplates[kind].forEach((template,index)=>{template.webTemplateId=`gsa-starter:${kind}:${index+1}`;});
