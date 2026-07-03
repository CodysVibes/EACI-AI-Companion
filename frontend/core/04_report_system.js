// ============================================================
// REPORT SYSTEM — User-facing issue reporting (event delegation)
// ============================================================
var _reportState = { category: '', issue: '' };

var REPORT_CATEGORIES = {
  chat: { label: 'Chat', issues: [
    'Messages are not sending','Messages take too long to load','Chat is completely unresponsive','Messages appear blank or empty','Chat shows wrong conversation','Messages are duplicated','Chat freezes after sending','Old messages disappeared','Cannot scroll through messages','Chat shows error message','Messages cut off mid-sentence','Chat loads but input does not work','Typing indicator stuck forever','Cannot delete messages','Chat resets on page reload','Messages appear out of order','Cannot copy message text','Chat lags when typing','Emoji or special characters break chat','Other chat issue'
  ]},
  live: { label: 'Live Chat', issues: [
    'Mic is on but nothing is heard','Caelum or Chad does not respond','Voice cuts out mid-sentence','Send message command not recognized','Live chat freezes completely','Audio plays but is garbled','Mic button does not respond','Live chat closes unexpectedly','Cannot hear Caelum or Chad speaking','Long delay before response','Transcription is completely wrong','Live chat tutorial will not stop','Mute button does not work','Huh button does not repeat','Status says listening but nothing happens','Cannot start live chat at all','Live chat drains battery fast','Audio echoes or feeds back','Skip button does not work','Other live chat issue'
  ]},
  caelum: { label: 'Caelum', issues: [
    'Caelum is being inappropriate','Caelum is repeating herself','Caelum is not responding at all','Caelum is stuck thinking forever','Caelum forgot who I am','Caelum is not making sense','Caelum seems emotionally off','Caelum is ignoring my question','Caelum gave wrong information','Caelum personality feels different','Caelum is too short in responses','Caelum is too long in responses','Caelum mood is stuck and will not change','Caelum is breaking character','Caelum is saying things she should not','Caelum is not reading messages aloud','Caelum voice sounds wrong','Caelum is not remembering our conversation','Caelum is being cold or distant','Other Caelum issue'
  ]},
  chad: { label: 'Chad', issues: [
    'Chad is being inappropriate','Chad is repeating himself','Chad is not responding at all','Chad is stuck thinking forever','Chad forgot who I am','Chad is not making sense','Chad seems emotionally off','Chad is ignoring my question','Chad gave wrong information','Chad personality feels different','Chad is too short in responses','Chad is too long in responses','Chad mood is stuck and will not change','Chad is breaking character','Chad is saying things he should not','Chad is not reading messages aloud','Chad voice sounds wrong','Chad is not remembering our conversation','Chad is being too aggressive','Other Chad issue'
  ]},
  together: { label: 'Together Mode', issues: [
    'Only one responds instead of both','They are talking over each other','Together mode is not available','Responses are identical from both','One is stuck thinking while other responds','Together mode is very slow','Conversation does not flow naturally','They contradict each other','Cannot switch to together mode','Together mode crashes the app','One personality dominates the other','They ignore each other','Responses are too long in together','Cannot exit together mode','Together mode uses too many API calls','They repeat what the other said','Mood does not sync between them','Together mode breaks after a few messages','Audio overlaps when both speak','Other together mode issue'
  ]},
  memories: { label: 'Memories', issues: [
    'Memories are not saving','Memories disappeared','Cannot delete a memory','Memory content is wrong','Memories are duplicated','Search does not find memories','Memory list is empty','Cannot create new memory','Memories from wrong conversation','Memory sidebar will not open','Memories load very slowly','Memory count is wrong','Memories reset on login','Cannot edit a memory','Memories show for wrong user','Memory categories are wrong','Too many memories showing','Memory sidebar is blank','Memories not syncing across devices','Other memory issue'
  ]},
  history: { label: 'Conversation History', issues: [
    'History is completely empty','History shows wrong conversations','History did not save','History loads old data','Cannot clear history','History is duplicated','History missing recent messages','History from wrong tab showing','History takes too long to load','Cannot export history','History resets on login','History shows corrupted text','History order is wrong','History panel will not open','History not syncing across devices','History shows deleted messages','Cannot search history','History is too large and slow','History missing timestamps','Other history issue'
  ]},
  api: { label: 'API Counter', issues: [
    'Counter shows wrong number','Counter did not reset at midnight','Counter says zero but I have calls left','Counter reset but I still cannot send','API limit reached too early','Counter not updating after messages','Counter shows negative number','Counter does not match my tier','Counter reset mid-day unexpectedly','Unlimited tier still shows counter','Counter stuck at same number','Counter jumps by more than one','Counter different on different devices','Cannot see the counter','Counter overlaps other elements','Tier badge shows wrong tier','Counter does not appear on mobile','Subscription not reflected in counter','Counter resets on page reload','Other API counter issue'
  ]},
  readaloud: { label: 'Read Aloud', issues: [
    'Messages are not reading aloud','Audio cuts off mid-sentence','Voice sounds robotic or wrong','Audio plays but no sound','Long messages do not read at all','Audio is too quiet','Audio is too loud','Stop button does not stop audio','Play button does not work','Audio plays wrong message','Audio has long delay before playing','Audio skips words or sentences','Audio plays twice','Cannot hear audio on mobile','Audio continues after leaving chat','Wrong voice is used','Audio quality is poor','Audio plays for wrong character','Experience mode audio not working','Other read aloud issue'
  ]},
  textbox: { label: 'Text Box & Buttons', issues: [
    'Cannot type in the text box','Send button does not work','Text box is too small','Keyboard covers text box on mobile','Text disappears after typing','Cannot paste text','Text box does not clear after sending','Buttons are not responding','Buttons overlap on mobile','MIC button does not appear','LIVE button does not work','Settings button broken','Tab buttons not switching','Text box loses focus','Cannot press Enter to send','Buttons are too small to tap','Text box shows old text','Autocorrect interferes with input','Text box scrolls incorrectly','Other text box or button issue'
  ]},
  thoughts: { label: 'Thoughts Panel', issues: [
    'Thoughts panel is empty','Thoughts are not updating','Thoughts panel will not open','Thoughts panel will not close','Thoughts are repeating','Thoughts do not match conversation','Thoughts panel covers chat','Thoughts are too fast to read','Thoughts panel is blank','Cannot scroll thoughts','Thoughts show for wrong character','Thought toggle button broken','Thoughts panel lags the app','Thoughts are inappropriate','Thoughts stopped generating','Thoughts panel too wide on mobile','Emotional thoughts not showing','Chad thoughts not appearing','Thoughts from old conversation showing','Other thoughts issue'
  ]},
  account: { label: 'Account & Login', issues: [
    'Cannot log in','Cannot create account','Password reset not working','Verification email not received','Account locked unexpectedly','Cannot change password','Profile info is wrong','Cannot log out','Session expires too quickly','Login works on one device but not another','Two-factor issues','Account deleted unexpectedly','Cannot update email','Username taken but should not be','Login screen keeps appearing','Subscription not showing after payment','Cannot delete account','Login is very slow','Remember me not working','Other account issue'
  ]},
  other: { label: 'Other Issue', issues: [
    'App is very slow','App crashes or freezes','App does not load at all','White or blank screen','App uses too much battery','App uses too much data','Notifications not working','Offline mode not working','App looks broken on my device','Dark mode or theme issues','Accessibility issue','App takes too long to start','Background canvas not showing','Startup animation stuck','Settings not saving','App works on desktop but not mobile','App works on mobile but not desktop','Something looks different than before','Feature I used is missing','Other issue not listed'
  ]}
};

function _reportEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function _bindReportBackdrop() {
  var overlay = document.getElementById('reportOverlay');
  if (!overlay || overlay._reportBackdropBound) return;
  overlay._reportBackdropBound = true;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeReport();
  });
}

function _wireReportButtons() {
  var root = document.getElementById('reportContent');
  if (!root) return;

  root.querySelectorAll('button[data-report-cat]').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.hasAttribute('data-report-issue-idx')) {
        var catKey = btn.getAttribute('data-report-cat');
        var idx = parseInt(btn.getAttribute('data-report-issue-idx'), 10);
        var issues = REPORT_CATEGORIES[catKey] && REPORT_CATEGORIES[catKey].issues;
        if (issues && issues[idx] != null) showReportForm(catKey, issues[idx]);
      } else {
        showReportIssues(btn.getAttribute('data-report-cat'));
      }
    };
  });

  root.querySelectorAll('button[data-report-back]').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var back = btn.getAttribute('data-report-back');
      if (back === 'menu') showReportMenu();
      else showReportIssues(back);
    };
  });

  root.querySelectorAll('button[data-report-submit]').forEach(function(btn) {
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      submitReport();
    };
  });
}

function showReportMenu() {
  var dupClose = document.querySelector('#reportBox .vm-panel-close');
  if (dupClose) dupClose.remove();
  _reportState = { category: '', issue: '' };
  var html = '<h2>&#9888; Report an Issue</h2><div class="report-sub">Select the area where you are experiencing a problem.</div>';
  html += '<div class="report-grid">';
  Object.keys(REPORT_CATEGORIES).forEach(function(key) {
    html += '<button type="button" data-report-cat="' + key + '">' + _reportEsc(REPORT_CATEGORIES[key].label) + '</button>';
  });
  html += '</div>';
  html += '<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:4px">Your report helps improve The Veil for everyone.</div>';
  document.getElementById('reportContent').innerHTML = html;
  document.getElementById('reportOverlay').classList.add('show');
  _bindReportBackdrop();
  _wireReportButtons();
}

function showReportIssues(cat) {
  _reportState.category = cat;
  var info = REPORT_CATEGORIES[cat];
  if (!info) return;
  var html = '<button type="button" class="report-back" data-report-back="menu">&larr; Back to categories</button>';
  html += '<h2>' + _reportEsc(info.label) + '</h2><div class="report-sub">What is happening?</div>';
  html += '<div class="report-list">';
  info.issues.forEach(function(issue, idx) {
    html += '<button type="button" data-report-cat="' + cat + '" data-report-issue-idx="' + idx + '">' + _reportEsc(issue) + '</button>';
  });
  html += '</div>';
  document.getElementById('reportContent').innerHTML = html;
  _wireReportButtons();
}

function showReportForm(cat, issue) {
  _reportState.category = cat;
  _reportState.issue = issue;
  var info = REPORT_CATEGORIES[cat];
  var html = '<button type="button" class="report-back" data-report-back="' + cat + '">&larr; Back to ' + _reportEsc(info.label) + '</button>';
  html += '<h2>Describe the Issue</h2>';
  html += '<div class="report-sub" style="color:#ffa500;font-weight:600">' + _reportEsc(info.label) + ' &rsaquo; ' + _reportEsc(issue) + '</div>';
  html += '<textarea id="reportDesc" placeholder="Tell us more about what happened. The more detail, the faster we can fix it..."></textarea>';
  html += '<label class="report-check"><input type="checkbox" id="reportEmailCheck" onchange="toggleReportEmail()"> I would like an email response</label>';
  html += '<div id="reportEmailWrap" style="display:none"><input type="email" id="reportEmail" placeholder="Your email address"><div style="font-size:9px;color:var(--muted);margin-bottom:8px">Response will come from codysvibes@gmail.com</div></div>';
  html += '<button type="button" class="report-submit" data-report-submit="1">Submit Report</button>';
  document.getElementById('reportContent').innerHTML = html;
  _wireReportButtons();
}

function toggleReportEmail() {
  var checked = document.getElementById('reportEmailCheck').checked;
  document.getElementById('reportEmailWrap').style.display = checked ? 'block' : 'none';
}

async function submitReport() {
  var descEl = document.getElementById('reportDesc');
  var desc = descEl ? descEl.value.trim() : '';
  var wantsEmail = document.getElementById('reportEmailCheck').checked;
  var email = wantsEmail ? (document.getElementById('reportEmail').value.trim()) : '';
  if (wantsEmail && (!email || !email.includes('@'))) {
    alert('Please enter a valid email address.');
    return;
  }
  var info = REPORT_CATEGORIES[_reportState.category] || {};
  var metadata = {
    category: info.label || _reportState.category,
    issue: _reportState.issue,
    wants_email: wantsEmail,
    contact_email: email,
    user_agent: navigator.userAgent,
    screen: window.innerWidth + 'x' + window.innerHeight,
    tab: state.currentTab || 'unknown',
    tier: billing.tier || 'free',
    timestamp: new Date().toISOString()
  };
  await logError(
    'user_report',
    '[' + (info.label || _reportState.category) + '] ' + _reportState.issue + (desc ? ' — ' + desc.substring(0, 500) : ''),
    desc.substring(0, 4000),
    '',
    metadata
  );
  document.getElementById('reportContent').innerHTML = '<div style="text-align:center;padding:30px 0"><div style="font-size:32px;margin-bottom:10px">&#10003;</div><h2 style="color:var(--accent)">Report Submitted</h2><div class="report-sub">Thank you for helping improve The Veil.' + (wantsEmail ? ' We will respond to ' + _reportEsc(email) + ' from codysvibes@gmail.com.' : '') + '</div><button type="button" class="report-submit" style="margin-top:16px" onclick="closeReport()">Close</button></div>';
}

function closeReport() {
  document.getElementById('reportOverlay').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', function() {
  _bindReportBackdrop();
  var box = document.getElementById('reportBox');
  if (box) {
    var dupClose = box.querySelector('.vm-panel-close');
    if (dupClose) dupClose.remove();
  }
});
