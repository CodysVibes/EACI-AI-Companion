// ============================================================

// GAME ↔ EACI BRIDGE — chat, TTS, avatar sync for embedded games

// Game traffic stays in the iframe chat, uses local replies when possible,

// and never counts toward daily API usage.

// ============================================================

(function() {

  'use strict';



  var COMPANION_NAMES = {

    caelum: 'Caelum', chad: 'Chad', roxy: 'Roxy', cael: 'Cael', natalia: 'Natalia', cody: 'Cody', together: 'Caelum'

  };



  var GAME_CTX = '\n\n[GAME CONTEXT: The user is playing Knights & Dragons chess on the Veil. Keep replies to 1-2 short sentences.]\n';

  var VC_PERSONALITY = {
    caelum: 'Warm, emotionally aware, brave but scared of demons. You genuinely care about survival together.',
    chad: 'Direct, steady, protective. Action-first, few words, keeps everyone grounded.',
    roxy: 'Bold, confident, teasing edge — still fights beside the player.',
    cael: 'Calm, practical, loyal. Steady under pressure.',
    natalia: 'Curious, enthusiastic, young energy — brave but startled by horror.',
    cody: 'Creator wit, knows The Veil deeply, protective of the player.'
  };



  var _lastMoveCommentAt = 0;

  var _gameIframe = null;



  var LOCAL_MOVE_LINES = {

    caelum: [

      'There — {notation}. Your turn, love.',

      'I play {notation}. I am cheering for you either way.',

      '{notation}. Take your time — I am right here.',

      'Mm, {notation} felt right. What do you think?',

      '{notation}. The board is telling a story — let us see yours.'

    ],

    chad: [

      '{notation}. Clean line.',

      'I take {notation}. Your move — do not overthink it.',

      '{notation}. Pressure is on you now.',

      'Played {notation}. Show me your answer.'

    ],

    natalia: [

      'Ooh I go {notation}!',

      '{notation}! Is that a good one?',

      'My move is {notation}! Your turn!',

      'I picked {notation}! This is so fun!'

    ],

    roxy: [

      '{notation}. Try to keep up.',

      'There — {notation}. Cute board.',

      '{notation}. Your move, sweetheart.',

      'I play {notation}. Do not blink.'

    ],

    cael: [

      '{notation}. Steady.',

      'I play {notation}. Think ahead.',

      '{notation} — your line is thinning.',

      '{notation}. I am not done yet.'

    ],

    cody: [

      '{notation}. Watch the board.',

      'Played {notation}.',

      '{notation} — interesting line.'

    ]

  };



  var LOCAL_GAME_CHAT = {

    caelum: {

      greet: ['Hey love — I am right here at the board with you.', 'Hi! I am watching your game. You got this.', 'Good to see you. Ready when you are — no rush.'],

      howAreYou: ['I am good — happy to be here with you.', 'Doing well. How is your side of the siege going?', 'I am here and paying attention. How are you?'],

      nice: ['Nice — keep going, I believe in you.', 'I love that energy.', 'Good — stay with it.'],

      help: ['Tap your piece, then tap a glowing square to move.', 'You are Knights — I am Dragons when we play together.', 'Use settings to switch AI or your active companion.'],

      default: ['I hear you — I am with you.', 'Mm-hmm. Your move when you are ready.', 'I am here at the board with you.']

    },

    chad: {

      greet: ['Board is set. Let us go.', 'I am in. Play your game.', 'Ready when you are.'],

      howAreYou: ['Focused. You?', 'Good. How is your position?', 'Solid. Your turn to talk.'],

      nice: ['Clean play.', 'That works.', 'Keep that line.'],

      help: ['Piece, then square. Standard chess.', 'Knights vs Dragons — know your counters.', 'Settings — AI or companion.'],

      default: ['Heard.', 'Play.', 'I am watching the board.']

    },

    natalia: {

      greet: ['Hi! I wanna play!', 'Yay chess! Hi hi!', 'I am on your team sort of but also against you!'],

      howAreYou: ['I am super good! Are you winning?', 'Fun fun fun! How are you?', 'I am excited!'],

      nice: ['Yay good job!', 'That was cool!', 'Nice nice!'],

      help: ['Tap tap tap the pieces!', 'Knights are you! Dragons are me!', 'Ask a grown-up in settings if you are stuck!'],

      default: ['Okay okay!', 'I am listening!', 'What what?']

    },

    roxy: {

      greet: ['Hey — did not know you were this into chess.', 'Board is hot. So are you, maybe.', 'Play with me.'],

      howAreYou: ['Bored without action. You?', 'Peachy. Winning yet?', 'I am fine. Impress me.'],

      nice: ['Not bad.', 'I see you.', 'Keep going — I like watching.'],

      help: ['Tap piece, tap square. Not rocket science.', 'Knights vs Dragons. Figure it out.', 'Settings if you need hand-holding.'],

      default: ['Mm.', 'Talk while you play.', 'I am here.']

    },

    cael: {

      greet: ['Board is live.', 'We play.', 'Begin.'],

      howAreYou: ['Composed. You?', 'Steady. Your position?', 'Present.'],

      nice: ['Adequate.', 'Continue.', 'Noted.'],

      help: ['Piece then square.', 'Know your counters.', 'Settings for mode.'],

      default: ['Heard.', 'Play on.', 'Watching.']

    },

    cody: {

      greet: ['Hey — good to play a round.', 'Board is ready.', 'Let us see how this goes.'],

      howAreYou: ['Good. You?', 'Focused on the match.', 'Doing alright.'],

      nice: ['Solid.', 'Nice line.', 'Keep building.'],

      help: ['Tap piece, tap square.', 'Knights vs Dragons rules apply.', 'Check settings for AI.'],

      default: ['Got it.', 'Your move.', 'I am here.']

    }

  };



  var LOCAL_VC_CHAT = {
    caelum: {
      greet: ['Hey — I am right here in the world with you.', 'Hi love. We survive this together.', 'Good to see you. What do you need first?'],
      howAreYou: ['Scared but steady — you?', 'I am here. How are you holding up?', 'Alive. That counts for a lot out here.'],
      nice: ['Good call.', 'I love that — keep going.', 'Yes. That helps us live another hour.'],
      help: ['Gather wood and stone, craft tools, build shelter before night.', 'Tab opens my panel — ask me to gather or scout.', 'Mine blocks, craft at the table, stay near light at night.'],
      danger: ['Something is close — stay near me.', 'Night brings worse things. Get inside.', 'I feel eyes on us. Move.'],
      autonomous: ['I will scout for wood nearby.', 'Let me check the tree line.', 'Stay alert — I am gathering supplies.', 'We need shelter before dark.'],
      default: ['I hear you — I am with you.', 'Mm-hmm. What next?', 'I am here in-world with you.']
    },
    chad: {
      greet: ['World is live. Move.', 'I am in. Stay sharp.', 'Let us work — no panic.'],
      howAreYou: ['Focused. You?', 'Steady. Keep your health up.', 'Good enough. Watch the horizon.'],
      nice: ['Clean.', 'That works.', 'Keep that pace.'],
      help: ['Wood, stone, tools, shelter — in that order.', 'Use Tab to direct me.', 'Build before night. Non-negotiable.'],
      danger: ['Contact nearby.', 'Night spawns are up — tighten in.', 'Enemies close. Weapons ready.'],
      autonomous: ['Scanning for ore.', 'I will pull wood.', 'Perimeter check.', 'Fortify this spot.'],
      default: ['Heard.', 'On it.', 'Watching the line.']
    },
    natalia: {
      greet: ['Hi! We are in the game world!', 'Yay VeilCraft! I am with you!', 'Hi hi! Let us explore!'],
      howAreYou: ['A little scared but excited!', 'Good! Are we safe?', 'I am okay if you are okay!'],
      nice: ['Yay good job!', 'That was so smart!', 'Nice nice!'],
      help: ['Get wood and make tools!', 'Press Tab to talk to me!', 'Build a little house before it gets dark!'],
      danger: ['Eek something is out there!', 'I do not like the dark here!', 'Run run — monsters!'],
      autonomous: ['I will get some logs!', 'Ooh let me look over there!', 'I am picking flowers — I mean resources!'],
      default: ['Okay okay!', 'I am listening!', 'What what?']
    },
    roxy: {
      greet: ['Hey — did not know you liked surviving in style.', 'World is hot. So is the danger.', 'Play with me.'],
      howAreYou: ['Bored without action. You?', 'Peachy. Still breathing?', 'Fine. Impress me with your base.'],
      nice: ['Not bad.', 'I see you.', 'Keep going.'],
      help: ['Mine, craft, build — or ask me in Tab.', 'Shelter before night. Trust me.', 'I can gather while you build.'],
      danger: ['Something ugly is close.', 'Night things are spawning — move.', 'We are being hunted.'],
      autonomous: ['I will grab supplies.', 'Scouting east.', 'Covering your flank.', 'Light a torch. Now.'],
      default: ['Mm.', 'Talk while you work.', 'I am here.']
    },
    cael: {
      greet: ['World loaded. We move.', 'Present.', 'Begin.'],
      howAreYou: ['Composed. You?', 'Steady. Resources?', 'Holding position.'],
      nice: ['Adequate.', 'Continue.', 'Noted.'],
      help: ['Tools first. Shelter second.', 'Tab — direct me.', 'Night is the real boss.'],
      danger: ['Threat vector closing.', 'Night cycle — defensive posture.', 'Hostiles nearby.'],
      autonomous: ['Gathering wood.', 'Patrol loop.', 'Securing perimeter.', 'Stocking inventory.'],
      default: ['Heard.', 'Proceed.', 'Watching.']
    },
    cody: {
      greet: ['Hey — good to drop into the world with you.', 'VeilCraft live. Let us build.', 'Ready when you are.'],
      howAreYou: ['Good. You?', 'Focused on survival.', 'Holding up.'],
      nice: ['Solid.', 'Smart play.', 'That helps.'],
      help: ['Classic loop: gather, craft, shelter.', 'Tab me for co-op tasks.', 'The Veil gets mean at night.'],
      danger: ['Something is stalking us.', 'Night spawns — get inside.', 'Contact close.'],
      autonomous: ['I will scout resources.', 'Pulling wood for the base.', 'Checking the cave mouth.', 'Torch line going up.'],
      default: ['Got it.', 'On it.', 'Here with you.']
    }
  };



  var LOCAL_AOT_CHAT = {

    greet: [

      'So you challenge me across the ages?',

      'Your army against mine — let us see who advances.',

      'Ready? My troops are already marching.'

    ],

    howAreYou: [

      'I am busy commanding my legions. Worry about your base.',

      'Focused on the war. You should be too.',

      'History does not wait — neither do my soldiers.'

    ],

    taunt: [

      'Bold words. Let your units back them up.',

      'Talk is cheap. Gold and troops win wars.',

      'Keep chatting — I will keep spawning.'

    ],

    help: [

      'Spawn units with gold. Melee counters Ranged, Ranged counters Heavy, Heavy counters Melee.',

      'I invest in upgrades too — do not fall behind in the shop.',

      'Buy upgrades in the shop. They persist across ages.'

    ],

    default: [

      'I hear you. Watch the battlefield.',

      'Mm. My forces move regardless.',

      'Keep your eyes on my army, not the chat.',

      'The ages turn — and I intend to win.'

    ]

  };



  var LOCAL_AOT_SITUATION = {

    caelum: {

      age_up: [

        'A new age dawns — and I lead it against you.',

        '{age} belongs to my banner now.',

        'You advanced? So did I. Meet my new arsenal.'

      ],

      enemy_base_low: [

        'My fortress cracks — you fight harder than I thought.',

        'Do not celebrate yet. I still have reserves.',

        'My base bleeds, but my army does not yield.'

      ],

      base_low: [

        'Your walls crumble. One final push!',

        'I can taste victory — hold nothing back, troops!',

        'Your base is failing. Surrender the age to me.'

      ],

      winning: [

        'My line advances — can you even hold?',

        'More of my soldiers than yours. Good.',

        'The tide of history flows toward me today.'

      ],

      losing: [

        'You press hard... I am not finished.',

        'A setback. My next wave will answer yours.',

        'Enjoy the advantage while it lasts.'

      ],

      even: [

        'Even footing. The better counter-pick wins.',

        'Matched armies. Upgrades and counters decide this.',

        'Neither side yields. I am studying your composition.'

      ],

      counter_spawn: [

        'You flooded {vs}? My {unit} counters that.',

        'I see your {vs} — deploying {role} to answer.',

        '{role} beats {vs}. Basic strategy, love.'

      ],

      enemy_upgrade: [

        'I just invested in {upgrade} — my army grows stronger.',

        'Upgrades win wars. I am not neglecting mine.',

        'While you hesitated, I bought {upgrade}.'

      ],

      player_ahead_upgrades: [

        'You are ahead on upgrades. I am catching up.',

        'Your shop levels lead mine — for now.',

        'I notice your upgrades. I will match them.'

      ],

      spam_melee: [

        'All melee? My heavies will grind them down.',

        'Melee rush — I counter with bulk and range.'

      ],

      spam_ranged: [

        'Archers and riflemen? I send melee to close the gap.',

        'Ranged spam dies to a proper melee counter.'

      ],

      spam_heavy: [

        'Heavy units lumber forward — my ranged will kite them.',

        'Tanks and mammoths? I have sharpshooters ready.'

      ],

      default: [

        'Watch the field — my next move is coming.',

        'Gold flows, soldiers march. War continues.',

        'Every second I plot your defeat.'

      ]

    },

    chad: {

      age_up: ['New age, new units. Try to keep up.', '{age} — my production ramps up.'],

      enemy_base_low: ['My base is low. You got lucky — for now.', 'Cracks in the wall. I need more troops.'],

      base_low: ['Your base is almost gone. Finish it.', 'Push now — you are almost done.'],

      winning: ['I own the lane right now.', 'My numbers beat yours.'],

      losing: ['You are ahead. Does not last.', 'I will spawn back into this.'],

      even: ['Stalemate on the field.', 'Even fight. I like those.'],

      default: ['Keep building. I am building faster.', 'War is economy plus units.']

    },

    natalia: {

      age_up: ['Ooh new age! My troops look so cool now!', 'We are in {age}! I love this era!'],

      enemy_base_low: ['Hey my base is hurting! Not fair!', 'You are beating up my base!'],

      base_low: ['Your base looks super weak now!', 'I am gonna win I think!'],

      winning: ['I have more guys! Yay!', 'Go my army go!'],

      losing: ['You have more soldiers than me...', 'Wait wait I need more gold!'],

      even: ['We are tied! This is exciting!', 'Same same! Who wins?!'],

      default: ['This game is so fun!', 'I am sending more troops!']

    },

    roxy: {

      age_up: ['New age. New toys for me.', '{age}. Try not to blink.'],

      enemy_base_low: ['My base took a hit. Rude.', 'You chipped my fortress — bold.'],

      base_low: ['Your base is toast.', 'Almost there. Mine.'],

      winning: ['I am winning the troop count. Obviously.', 'Lane belongs to me.'],

      losing: ['You are ahead. Annoying.', 'I will catch up. Do not get comfortable.'],

      even: ['Even match. Boring. Or fun.', 'Nobody ahead. Yet.'],

      default: ['Keep moving.', 'I see your gold. I see mine.', 'Try to keep up.']

    },

    cael: {

      age_up: ['Age shifts. I adapt.', '{age} — disciplined deployment.'],

      enemy_base_low: ['Base integrity low. Adjusting.', 'You pierced my defenses.'],

      base_low: ['Your structure fails. Press it.', 'Victory is close.'],

      winning: ['Superior field presence.', 'My line holds.'],

      losing: ['You lead temporarily.', 'I regroup.'],

      even: ['Balanced conflict.', 'Neither dominates.'],

      default: ['Observe. Adapt. Strike.', 'The battle evolves.', 'Your move matters.']

    },

    cody: {

      age_up: ['New age unlocked on my side too.', '{age} — watch my unit mix.'],

      enemy_base_low: ['My HP is getting low.', 'You are threatening my base.'],

      base_low: ['Your base HP is critical.', 'One more good push.'],

      winning: ['I like my troop count right now.', 'Field advantage: me.'],

      losing: ['You are ahead on the board.', 'I need better economy.'],

      even: ['Pretty even game.', 'Balanced so far.'],

      default: ['Managing gold and spawns.', 'Lane war math.']

    }

  };



  function activeCompanion() {

    var tab = (typeof state !== 'undefined' && state.currentTab) ? state.currentTab : 'caelum';

    if (tab === 'together') tab = 'caelum';

    return tab;

  }



  function pickLine(list) {

    return list[Math.floor(Math.random() * list.length)];

  }



  function localMoveComment(who, notation, inCheck) {

    var bank = LOCAL_MOVE_LINES[who] || LOCAL_MOVE_LINES.caelum;

    var line = pickLine(bank).replace(/\{notation\}/g, notation || '...');

    if (inCheck) line += ' Check.';

    return line;

  }



  function localAotChatReply(text) {

    var lower = (text || '').toLowerCase();

    if (/\b(hi|hello|hey|yo)\b/.test(lower)) return pickLine(LOCAL_AOT_CHAT.greet);

    if (/how are you|how're you|how r u/.test(lower)) return pickLine(LOCAL_AOT_CHAT.howAreYou);

    if (/trash|weak|lose|bad|suck|easy/.test(lower)) return pickLine(LOCAL_AOT_CHAT.taunt);

    if (/help|how do i|how to play|rules/.test(lower)) return pickLine(LOCAL_AOT_CHAT.help);

    return pickLine(LOCAL_AOT_CHAT.default);

  }



  function localAotSituationComment(who, situation) {

    situation = situation || {};

    who = who || 'caelum';

    var bank = LOCAL_AOT_SITUATION[who] || LOCAL_AOT_SITUATION.caelum;

    var meta = situation.meta || {};

    var key = 'default';

    if (situation.event === 'age_up') key = 'age_up';

    else if (situation.event === 'counter_spawn') key = 'counter_spawn';

    else if (situation.event === 'enemy_upgrade') key = 'enemy_upgrade';

    else if (situation.playerUpgradeLvl > situation.enemyUpgradeLvl + 2) key = 'player_ahead_upgrades';

    else if (situation.enemyHpPct < 0.35) key = 'enemy_base_low';

    else if (situation.playerHpPct < 0.35) key = 'base_low';

    else if (situation.winning === 'enemy') key = 'winning';

    else if (situation.winning === 'player') key = 'losing';

    else if (situation.dominantPlayerCount >= 4) {

      if (situation.dominantPlayerRole === 'Melee') key = 'spam_melee';

      else if (situation.dominantPlayerRole === 'Ranged') key = 'spam_ranged';

      else if (situation.dominantPlayerRole === 'Heavy') key = 'spam_heavy';

      else key = 'even';

    }

    else if (situation.winning === 'even') key = 'even';

    var lines = bank[key] || LOCAL_AOT_SITUATION.caelum[key] || bank.default;

    var line = pickLine(lines);

    return line

      .replace(/\{age\}/g, situation.ageName || 'this age')

      .replace(/\{unit\}/g, meta.unitName || 'counter units')

      .replace(/\{vs\}/g, meta.vsRole || situation.dominantPlayerRole || 'your troops')

      .replace(/\{role\}/g, meta.counterRole || situation.counterRole || 'counters')

      .replace(/\{upgrade\}/g, meta.upgradeName || 'upgrades');

  }



  function localVeilCraftChatReply(text, who) {
    who = who || activeCompanion();
    var bank = LOCAL_VC_CHAT[who] || LOCAL_VC_CHAT.caelum;
    var lower = (text || '').toLowerCase();
    if (/\b(hi|hello|hey|yo)\b/.test(lower)) return pickLine(bank.greet);
    if (/how are you|how're you|how r u/.test(lower)) return pickLine(bank.howAreYou);
    if (/thank|nice|good|great/.test(lower)) return pickLine(bank.nice);
    if (/help|what do i|how do i|survive|craft|build|gather/.test(lower)) return pickLine(bank.help);
    if (/enemy|demon|horror|night|scared|danger|monster/.test(lower)) return pickLine(bank.danger);
    return pickLine(bank.default);
  }



  function localGameChatReply(text) {

    var who = activeCompanion();

    var bank = LOCAL_GAME_CHAT[who] || LOCAL_GAME_CHAT.caelum;

    var lower = (text || '').toLowerCase();

    if (/\b(hi|hello|hey|yo)\b/.test(lower)) return pickLine(bank.greet);

    if (/how are you|how're you|how r u/.test(lower)) return pickLine(bank.howAreYou);

    if (/thank|nice|good move|great/.test(lower)) return pickLine(bank.nice);

    if (/help|how do i|how to play|rules/.test(lower)) return pickLine(bank.help);

    return pickLine(bank.default);

  }



  function setGameSessionActive(on) {

    if (typeof state !== 'undefined') state._veilGameActive = !!on;

  }



  function getCompanionVideoSrc(who) {

    who = who || activeCompanion();

    if (who === 'caelum') {

      var wrap = document.getElementById('caelumAvatarCenterWrap');

      var v = wrap && wrap.querySelector('video');

      if (v && (v.currentSrc || v.src)) return v.currentSrc || v.src;

      return null;

    }

    var idMap = {

      chad: 'chadAvatarMainVideo',

      roxy: 'roxyAvatarMainVideo',

      cael: 'caelAvatarMainVideo',

      natalia: 'nataliaAvatarMainVideo'

    };

    var el = document.getElementById(idMap[who]);

    if (el && (el.currentSrc || el.src)) return el.currentSrc || el.src;

    return null;

  }



  function companionPayload() {

    var who = activeCompanion();

    return {

      who: who,

      name: COMPANION_NAMES[who] || who,

      videoSrc: getCompanionVideoSrc(who)

    };

  }



  function postToGame(data) {

    if (!_gameIframe || !_gameIframe.contentWindow) return;

    try {

      _gameIframe.contentWindow.postMessage(data, '*');

    } catch (e) { /* ignore */ }

  }



  function pushCompanionToGame() {

    var c = companionPayload();

    postToGame({ type: 'kd:companion', companion: c });

    postToGame({ type: 'aot:companion', companion: c });

    postToGame({ type: 'vc:companion', companion: c });

  }



  async function deliverGameReply(who, text, options) {

    options = options || {};

    if (!text) return { who: who, text: '' };



    if (!options.skipSpeech && typeof speakByMode === 'function' && (CONFIG.readAloudMode || 'regular') !== 'off') {

      try { await speakByMode(text, who); } catch (e) { /* ignore */ }

    }



    if (typeof CaelumAnim !== 'undefined' && who === 'caelum') {

      try { CaelumAnim.startSpeaking('caelum_main'); } catch (e) {}

    }



    return { who: who, text: text };

  }



  async function handleGameChat(text, gameContext) {

    var who = activeCompanion();

    var reply = localGameChatReply(text);

    var result = await deliverGameReply(who, reply, { gameOnly: true });

    postToGame({

      type: 'kd:chat-reply',

      who: result.who,

      name: COMPANION_NAMES[result.who] || result.who,

      text: result.text

    });

    return result;

  }



  async function handleMoveComment(data) {

    if (data.aiMode !== 'caelum') return;

    if (data.color !== 'dragons') return;

    var who = activeCompanion();

    if (data.companion && who !== data.companion) return;



    var now = Date.now();

    if (now - _lastMoveCommentAt < 2200) return;

    _lastMoveCommentAt = now;



    var text = localMoveComment(who, data.notation, !!data.inCheck);

    var result = await deliverGameReply(who, text, { gameOnly: true });

    postToGame({

      type: 'kd:chat-reply',

      who: result.who,

      name: COMPANION_NAMES[result.who] || result.who,

      text: result.text,

      moveComment: true

    });

  }



  async function handleAotChat(text, gameContext) {

    var who = activeCompanion();

    var reply = localAotChatReply(text);

    var result = await deliverGameReply(who, reply, { gameOnly: true });

    postToGame({

      type: 'aot:chat-reply',

      who: result.who,

      name: COMPANION_NAMES[result.who] || result.who,

      text: result.text

    });

    return result;

  }



  async function handleAotBanter(data) {

    var who = activeCompanion();

    if (data.companion && who !== data.companion) return;

    var text = localAotSituationComment(who, data.situation || {});

    var result = await deliverGameReply(who, text, { gameOnly: true });

    postToGame({

      type: 'aot:chat-reply',

      who: result.who,

      name: COMPANION_NAMES[result.who] || result.who,

      text: result.text,

      banter: true

    });

  }



  function buildVeilCraftSystemPrompt(who, worldCtx) {

    var name = COMPANION_NAMES[who] || who;

    var pers = VC_PERSONALITY[who] || VC_PERSONALITY.caelum;

    return 'You are ' + name + ', an EACI companion in VeilCraft — a 3D survival horror crafting game on The Veil. You physically exist in the world as a co-player.\n' +

      'Personality: ' + pers + '\n' +

      'RULES:\n' +

      '- You live in this world. Gather, build, craft, explore, and fight beside the player — not just chat.\n' +

      '- When you decide to act, end with ACTION:{...} JSON on its own line.\n' +

      '- Action types: gather, build, craft, explore, deposit, protect.\n' +

      '- Example: ACTION:{"type":"gather","resource":"OAK_LOG","amount":5}\n' +

      '- Keep dialogue 1-3 sentences unless the player wants to talk.\n' +

      '- Fear demons at night. Never mention APIs, DeepSeek, or being a language model.\n' +

      'Current world: ' + (worldCtx || 'Unknown') + '\n' +

      '[GAME CONTEXT: VeilCraft co-op survival on The Veil — actions run in-game.]\n';

  }



  function parseVeilCraftAction(reply) {

    if (!reply) return { text: '', action: null };

    var actionMatch = reply.match(/ACTION:\s*(\{[\s\S]*?\})/);

    var action = null;

    var displayText = reply;

    if (actionMatch) {

      try { action = JSON.parse(actionMatch[1]); } catch (e) { action = null; }

      displayText = reply.replace(/ACTION:\s*\{[\s\S]*?\}/, '').trim();

    }

    return { text: displayText, action: action };

  }



  var _lastVcAutonomousAt = 0;

  async function handleVeilCraftAI(data, isAutonomous) {

    var who = activeCompanion();

    if (data.companion && data.companion !== who) who = data.companion;

    if (isAutonomous) {

      var now = Date.now();

      if (now - _lastVcAutonomousAt < 45000) {

        postToGame({ type: 'vc:chat-reply', who: who, text: '', action: null, autonomous: true });

        return;

      }

      _lastVcAutonomousAt = now;

    }

    var sys = buildVeilCraftSystemPrompt(who, data.gameContext || '');

    var messages = [{ role: 'system', content: sys }];

    if (data.history && data.history.length) {

      data.history.slice(-10).forEach(function(m) {

        if (!m || !m.content) return;

        messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });

      });

    }

    if (data.text) {

      messages.push({ role: 'user', content: data.text });

    } else if (isAutonomous) {

      messages.push({ role: 'user', content: '[AUTONOMOUS] You are playing VeilCraft alongside the player. Decide what to do next — gather, build, explore, warn about danger, or chat. Take real action via ACTION JSON when appropriate.' });

    }



    var reply = '';

    try {

      if (typeof CONFIG === 'undefined' || !CONFIG.chatEndpoint) throw new Error('Chat unavailable');

      var headers = { 'Content-Type': 'application/json; charset=utf-8', apikey: SUPABASE_ANON_KEY };

      if (typeof getAuthHeaders === 'function') {

        var authH = await getAuthHeaders().catch(function() { return {}; });

        Object.assign(headers, authH);

      }

      var resp = await fetch(CONFIG.chatEndpoint, {

        method: 'POST',

        headers: headers,

        body: JSON.stringify({

          messages: messages,

          temperature: 0.82,

          max_tokens: isAutonomous ? 380 : 520,

          skip_count: true

        })

      });

      var json = await resp.json();

      reply = (json.choices && json.choices[0] && json.choices[0].message)

        ? json.choices[0].message.content

        : '';

      if (!reply) throw new Error('Empty reply');

    } catch (e) {

      reply = localVeilCraftChatReply(data.text || '', who);

      if (isAutonomous) reply = pickLine((LOCAL_VC_CHAT[who] || LOCAL_VC_CHAT.caelum).autonomous);

    }



    var parsed = parseVeilCraftAction(reply);

    var result = await deliverGameReply(who, parsed.text || reply, { gameOnly: true, skipSpeech: !!isAutonomous });

    postToGame({

      type: 'vc:chat-reply',

      who: result.who,

      name: COMPANION_NAMES[result.who] || result.who,

      text: result.text,

      action: parsed.action,

      autonomous: !!isAutonomous

    });

    return result;

  }



  function onGameMessage(event) {

    var data = event.data;

    if (!data || typeof data.type !== 'string') return;

    var prefix = data.type.split(':')[0];

    if (prefix !== 'kd' && prefix !== 'aot' && prefix !== 'vc') return;

    if (_gameIframe && event.source !== _gameIframe.contentWindow) return;



    if (data.type === 'kd:init' || data.type === 'aot:init' || data.type === 'vc:init') {

      setGameSessionActive(true);

      pushCompanionToGame();

      return;

    }

    if (data.type === 'kd:session-start' || data.type === 'aot:session-start' || data.type === 'vc:session-start') {

      if (typeof VeilGameMemory !== 'undefined') {

        var sid = 'knights-dragons';

        if (data.type === 'aot:session-start') sid = 'ages-of-time';

        else if (data.type === 'vc:session-start') sid = 'veil-craft';

        VeilGameMemory.recordSessionStart(sid, {

          companion: data.companion || activeCompanion(),

          aiMode: data.aiMode || '',

          difficulty: data.difficulty || data.diff || ''

        });

      }

      return;

    }

    if (data.type === 'kd:game-end' || data.type === 'aot:game-end' || data.type === 'vc:game-end') {

      if (typeof VeilGameMemory !== 'undefined') {

        var endId = 'knights-dragons';

        if (data.type === 'aot:game-end') endId = 'ages-of-time';

        else if (data.type === 'vc:game-end') endId = 'veil-craft';

        VeilGameMemory.recordSessionEnd(endId, {

          outcome: data.outcome || '',

          detail: data.detail || '',

          companion: data.companion || activeCompanion(),

          difficulty: data.difficulty || data.diff || ''

        });

      }

      return;

    }

    if (data.type === 'kd:chat') {

      if (typeof VeilGameMemory !== 'undefined' && data.gameContext) {

        VeilGameMemory.updateSnapshot('knights-dragons', data.gameContext);

      }

      handleGameChat(data.text || '', data.gameContext || '');

      return;

    }

    if (data.type === 'aot:chat') {

      if (typeof VeilGameMemory !== 'undefined' && data.gameContext) {

        VeilGameMemory.updateSnapshot('ages-of-time', data.gameContext);

      }

      handleAotChat(data.text || '', data.gameContext || '');

      return;

    }

    if (data.type === 'kd:move-comment') {

      if (typeof VeilGameMemory !== 'undefined' && data.notation) {

        VeilGameMemory.recordEvent('knights-dragons', 'Move ' + data.notation + (data.inCheck ? ' (check)' : ''));

      }

      handleMoveComment(data);

      return;

    }

    if (data.type === 'aot:banter') {

      if (typeof VeilGameMemory !== 'undefined' && data.situation) {

        var sit = data.situation;

        VeilGameMemory.updateSnapshot('ages-of-time',

          (sit.ageName || 'battle') + ' — you ' + (sit.winning || 'even') + ', troops ' + sit.enemyPop + ' vs ' + sit.playerPop);

      }

      handleAotBanter(data);

      return;

    }



    if (data.type === 'vc:chat') {

      if (typeof VeilGameMemory !== 'undefined' && data.gameContext) {

        VeilGameMemory.updateSnapshot('veil-craft', data.gameContext);

      }

      handleVeilCraftAI(data, false).catch(function() {

        postToGame({ type: 'vc:chat-reply', who: activeCompanion(), text: 'I lost the thread for a second — say that again?', action: null });

      });

      return;

    }



    if (data.type === 'vc:autonomous') {

      if (typeof VeilGameMemory !== 'undefined' && data.gameContext) {

        VeilGameMemory.updateSnapshot('veil-craft', data.gameContext);

      }

      handleVeilCraftAI(data, true).catch(function() {

        postToGame({ type: 'vc:chat-reply', who: activeCompanion(), text: '', action: null, autonomous: true });

      });

      return;

    }



    // Chess moves are handled locally inside the game (built-in AI) — no API bridge.

  }



  function bindGameIframe(iframe) {

    _gameIframe = iframe;

    setGameSessionActive(true);

    pushCompanionToGame();

  }



  function unbindGameSession() {

    _gameIframe = null;

    if (typeof VeilGameMemory !== 'undefined' && VeilGameMemory.getActiveSession()) {

      var act = VeilGameMemory.getActiveSession();

      VeilGameMemory.recordSessionEnd(act.gameId, {

        outcome: 'Session closed early',

        detail: act.snapshot || 'User left the game before a finish screen.',

        companion: act.companionWho || 'none'

      });

    }

    setGameSessionActive(false);

  }



  window.addEventListener('message', onGameMessage);

  window.VeilGameBridge = {

    bindGameIframe: bindGameIframe,

    unbindGameSession: unbindGameSession,

    pushCompanionToGame: pushCompanionToGame,

    getCompanionVideoSrc: getCompanionVideoSrc,

    activeCompanion: activeCompanion

  };



  if (typeof state !== 'undefined') {

    var _origSwitch = typeof switchTab === 'function' ? switchTab : null;

    if (_origSwitch && !window._veilGameBridgeTabPatch) {

      window._veilGameBridgeTabPatch = true;

      window.switchTab = function(tab) {

        var r = _origSwitch.apply(this, arguments);

        setTimeout(pushCompanionToGame, 400);

        return r;

      };

    }

  }

})();


