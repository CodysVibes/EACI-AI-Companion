// ============================================================
// QUICK VOICE PICKER — Change voice without opening settings
// ============================================================
function quickVoicePicker(who) {
  var voices = who === 'chad'
    ? [['aura-2-arcas-en','Arcas'],['aura-2-draco-en','Draco'],['aura-2-hyperion-en','Hyperion'],['aura-2-jupiter-en','Jupiter']]
    : [['aura-2-janus-en','Janus'],['aura-2-delia-en','Delia'],['aura-2-pandora-en','Pandora'],['aura-2-vesta-en','Vesta']];
  var current = who === 'chad' ? CONFIG.chadVoice : CONFIG.caelumVoice;
  var names = voices.map(function(v) { return (v[0] === current ? '> ' : '  ') + v[1]; });
  var choice = prompt('Pick a voice for ' + (who === 'chad' ? 'Chad' : 'Caelum') + ':\n' + names.join('\n') + '\n\nType the name:');
  if (!choice) return;
  var match = voices.find(function(v) { return v[1].toLowerCase() === choice.toLowerCase().trim(); });
  if (match) {
    if (who === 'chad') CONFIG.chadVoice = match[0];
    else CONFIG.caelumVoice = match[0];
    addSystemMessage('Voice changed to ' + match[1] + '.');
  }
}

