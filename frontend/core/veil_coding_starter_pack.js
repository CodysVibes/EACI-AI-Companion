// ============================================================
// VEIL CODING STARTER PACK — day-one knowledge (no Llama, no wait)
// ~30 recipes + seeded prompt→code pairs every user gets immediately
// ============================================================
(function () {
  'use strict';

  var VEIL_STYLE = ':root{--bg:#0d0f1a;--fg:#e8e8f0;--accent:#00ffc8;--muted:#8ba8a0}*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.5}button,input,textarea{font:inherit}button{cursor:pointer;border:none;border-radius:8px;padding:10px 16px;background:var(--accent);color:#060400;font-weight:700}input,textarea{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#12141f;color:var(--fg)}';

  var RECIPES = [
    { id: 'todo_app', re: /\b(todo|to-do|task list|checklist)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Todo</title><style>' + VEIL_STYLE + 'main{max-width:480px;margin:2rem auto;padding:1rem}.row{display:flex;gap:8px;margin-bottom:12px}ul{list-style:none;padding:0}li{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)}.done{text-decoration:line-through;opacity:.5}</style></head>\n<body><main><h1>Todo</h1><div class="row"><input id="inp" placeholder="New task" /><button id="add">Add</button></div><ul id="list"></ul></main><script>\nvar tasks=JSON.parse(localStorage.getItem("veil_todos")||"[]");var list=document.getElementById("list");var inp=document.getElementById("inp");function save(){localStorage.setItem("veil_todos",JSON.stringify(tasks));}function render(){list.innerHTML="";tasks.forEach(function(t,i){var li=document.createElement("li");var cb=document.createElement("input");cb.type="checkbox";cb.checked=!!t.done;cb.onchange=function(){tasks[i].done=cb.checked;save();render();};var span=document.createElement("span");span.textContent=t.text;span.className=t.done?"done":"";var del=document.createElement("button");del.textContent="Delete";del.onclick=function(){tasks.splice(i,1);save();render();};li.append(cb,span,del);list.append(li);});}document.getElementById("add").onclick=function(){var v=inp.value.trim();if(!v)return;tasks.push({text:v,done:false});inp.value="";save();render();};inp.onkeydown=function(e){if(e.key==="Enter")document.getElementById("add").click();};render();\n<\/script></body></html>\n```\nVERIFY: Add tasks, check them off, reload — tasks persist.';
    }},
    { id: 'click_counter', re: /\b(counter|count clicks|click count|increment)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Counter</title><style>' + VEIL_STYLE + 'main{text-align:center;margin:4rem auto}#n{font-size:3rem;color:var(--accent)}</style></head>\n<body><main><h1>Counter</h1><div id="n">0</div><button id="btn">Click me</button></main><script>\nvar n=0;document.getElementById("btn").onclick=function(){n++;document.getElementById("n").textContent=n;};\n<\/script></body></html>\n```\nVERIFY: Click button — number increases.';
    }},
    { id: 'calculator', re: /\b(calculator|calc|add subtract multiply)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calculator</title><style>' + VEIL_STYLE + 'main{max-width:280px;margin:2rem auto}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}button{padding:14px 0}</style></head>\n<body><main><input id="disp" readonly value="0" style="margin-bottom:8px;text-align:right;font-size:1.4rem" /><div class="grid" id="keys"></div></main><script>\nvar disp=document.getElementById("disp");var cur="0";var keys=["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C"];var el=document.getElementById("keys");keys.forEach(function(k){var b=document.createElement("button");b.textContent=k;b.onclick=function(){if(k==="C"){cur="0";}else if(k==="="){try{cur=String(Function(\'"use strict";return (\'+cur+\')\')());}catch(e){cur="Err";}}else{cur=cur==="0"&&k!=="."?k:cur+k;}disp.value=cur;};el.append(b);});\n<\/script></body></html>\n```\nVERIFY: Press keys and = to calculate.';
    }},
    { id: 'contact_form', re: /\b(contact form|signup form|registration form|login form|html form)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contact</title><style>' + VEIL_STYLE + 'form{max-width:400px;margin:2rem auto;display:flex;flex-direction:column;gap:12px}label{font-size:.85rem;color:var(--muted)}</style></head>\n<body><form id="f"><h1>Contact</h1><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Message<textarea name="msg" rows="4" required></textarea></label><button type="submit">Send</button><p id="out"></p></form><script>\ndocument.getElementById("f").onsubmit=function(e){e.preventDefault();var d=new FormData(e.target);document.getElementById("out").textContent="Thanks, "+d.get("name")+"! (demo — no server)";};\n<\/script></body></html>\n```\nVERIFY: Fill form and submit — thank you message appears.';
    }},
    { id: 'timer', re: /\b(timer|stopwatch|countdown)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Timer</title><style>' + VEIL_STYLE + 'main{text-align:center;margin:3rem auto}#t{font-size:2.5rem;font-variant-numeric:tabular-nums}</style></head>\n<body><main><h1>Stopwatch</h1><div id="t">00:00</div><button id="go">Start</button> <button id="reset">Reset</button></main><script>\nvar ms=0,id=null;function fmt(){var s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}document.getElementById("go").onclick=function(){if(id){clearInterval(id);id=null;this.textContent="Start";return;}this.textContent="Pause";id=setInterval(function(){ms+=100;document.getElementById("t").textContent=fmt();},100);};document.getElementById("reset").onclick=function(){ms=0;document.getElementById("t").textContent=fmt();};\n<\/script></body></html>\n```\nVERIFY: Start, pause, reset.';
    }},
    { id: 'tabs_ui', re: /\b(tabs|tab panel|tabbed)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Tabs</title><style>' + VEIL_STYLE + '.tabs{display:flex;gap:4px;margin-bottom:12px}.tab{padding:8px 14px;background:#12141f;border-radius:8px;cursor:pointer}.tab.active{background:var(--accent);color:#060400}.panel{display:none}.panel.active{display:block}</style></head>\n<body><main style="max-width:480px;margin:2rem auto"><div class="tabs"><div class="tab active" data-i="0">One</div><div class="tab" data-i="1">Two</div></div><div class="panel active" data-i="0"><p>Panel one content.</p></div><div class="panel" data-i="1"><p>Panel two content.</p></div></main><script>\ndocument.querySelectorAll(".tab").forEach(function(t){t.onclick=function(){var i=t.dataset.i;document.querySelectorAll(".tab,.panel").forEach(function(el){el.classList.toggle("active",el.dataset.i===i);});};});\n<\/script></body></html>\n```\nVERIFY: Switch tabs.';
    }},
    { id: 'modal', re: /\b(modal|popup|dialog box)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Modal</title><style>' + VEIL_STYLE + '#ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);align-items:center;justify-content:center}#ov.show{display:flex}.box{background:#12141f;padding:1.5rem;border-radius:12px;max-width:360px}</style></head>\n<body><button id="open">Open modal</button><div id="ov"><div class="box"><h2>Hello</h2><p>Modal content here.</p><button id="close">Close</button></div></div><script>\nvar ov=document.getElementById("ov");document.getElementById("open").onclick=function(){ov.classList.add("show");};document.getElementById("close").onclick=function(){ov.classList.remove("show");};ov.onclick=function(e){if(e.target===ov)ov.classList.remove("show");};\n<\/script></body></html>\n```\nVERIFY: Open and close modal.';
    }},
    { id: 'dark_landing', re: /\b(html page|webpage|landing page|simple page|index\.html|website|dark theme)\b/i, body: function (req) {
      var title = (req.match(/called\s+["']?([^"'\n]+)["']?/i) || [])[1] || 'My Page';
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>' + VEIL_STYLE + 'main{padding:2rem;max-width:720px;margin:0 auto}h1{color:var(--accent)}</style></head>\n<body><main><h1>' + title + '</h1><p>Built with The Veil IDE.</p><button id="btn">Get started</button></main><script>document.getElementById("btn").onclick=function(){alert("It works!");};<\/script></body></html>\n```\nVERIFY: Preview and click button.';
    }},
    { id: 'hello_js', re: /\b(hello world|console\.log|simple script|javascript file)\b/i, body: function () {
      return 'FILENAME: script.js\n```javascript\nfunction main() {\n  console.log("Hello from The Veil IDE");\n  return "ok";\n}\nmain();\n```\nVERIFY: Run Preview.';
    }},
    { id: 'fetch_api', re: /\b(fetch|api call|get json|load data|http request)\b/i, body: function () {
      return 'FILENAME: api.js\n```javascript\nasync function fetchJson(url) {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error("HTTP " + res.status);\n  return res.json();\n}\nfetchJson("https://jsonplaceholder.typicode.com/todos/1")\n  .then(function(d) { console.log("OK", d); })\n  .catch(function(e) { console.error(e.message); });\n```\nVERIFY: Preview shows OK and data.';
    }},
    { id: 'local_storage', re: /\b(localstorage|local storage|save to browser|persist data)\b/i, body: function () {
      return 'FILENAME: storage.js\n```javascript\nfunction save(key, value) {\n  try { localStorage.setItem(key, JSON.stringify(value)); return true; }\n  catch (e) { console.error(e); return false; }\n}\nfunction load(key, fallback) {\n  try {\n    var raw = localStorage.getItem(key);\n    return raw ? JSON.parse(raw) : fallback;\n  } catch (e) { return fallback; }\n}\nsave("demo", { name: "Veil", count: 1 });\nconsole.log(load("demo"));\n```\nVERIFY: Preview logs saved object.';
    }},
    { id: 'array_methods', re: /\b(map filter reduce|array map|filter array)\b/i, body: function () {
      return 'FILENAME: arrays.js\n```javascript\nconst nums = [1, 2, 3, 4, 5];\nconst doubled = nums.map(function(n) { return n * 2; });\nconst evens = nums.filter(function(n) { return n % 2 === 0; });\nconst sum = nums.reduce(function(a, b) { return a + b; }, 0);\nconsole.log({ doubled, evens, sum });\n```\nVERIFY: Preview logs object with arrays and sum 15.';
    }},
    { id: 'debounce', re: /\b(debounce|search input|delay input)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Search</title><style>' + VEIL_STYLE + 'main{max-width:400px;margin:2rem auto}</style></head>\n<body><main><input id="q" placeholder="Search..." /><p id="log"></p></main><script>\nfunction debounce(fn,ms){var t;return function(){clearTimeout(t);var a=arguments;var self=this;t=setTimeout(function(){fn.apply(self,a);},ms);};}\ndocument.getElementById("q").oninput=debounce(function(e){document.getElementById("log").textContent="Searching: "+e.target.value;},300);\n<\/script></body></html>\n```\nVERIFY: Type in search — log updates after pause.';
    }},
    { id: 'css_card', re: /\b(css card|card component|card style)\b/i, body: function () {
      return 'FILENAME: card.css\n```css\n:root { --card-bg: #12141f; --accent: #00ffc8; }\n.card { background: var(--card-bg); border: 1px solid rgba(0,255,200,.2); border-radius: 12px; padding: 1.25rem; max-width: 360px; }\n.card h2 { margin: 0 0 .5rem; color: var(--accent); }\n```\nVERIFY: Use class="card" in HTML preview.';
    }},
    { id: 'css_flex', re: /\b(flexbox|flex layout|flex center)\b/i, body: function () {
      return 'FILENAME: layout.css\n```css\n.flex-center { display: flex; align-items: center; justify-content: center; min-height: 100vh; gap: 1rem; }\n.row { display: flex; flex-wrap: wrap; gap: 12px; }\n.col { flex: 1 1 200px; }\n```\nVERIFY: Apply classes in HTML preview.';
    }},
    { id: 'css_grid', re: /\b(css grid|grid layout)\b/i, body: function () {
      return 'FILENAME: grid.css\n```css\n.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }\n.grid-item { background: #12141f; padding: 1rem; border-radius: 8px; }\n```\nVERIFY: Use class grid with grid-item children.';
    }},
    { id: 'css_reset', re: /\b(css reset|base styles|normalize)\b/i, body: function () {
      return 'FILENAME: base.css\n```css\n*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }\nimg { max-width: 100%; height: auto; display: block; }\nbutton, input, textarea { font: inherit; }\n```\nVERIFY: Link in HTML preview.';
    }},
    { id: 'css_animation', re: /\b(css animation|fade in|keyframes)\b/i, body: function () {
      return 'FILENAME: anim.css\n```css\n@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n.fade-in { animation: fadeIn .4s ease-out both; }\n```\nVERIFY: Add class fade-in to an element in preview.';
    }},
    { id: 'python_hello', re: /\b(python hello|\.py|python script)\b/i, body: function () {
      return 'FILENAME: main.py\n```python\ndef main():\n    print("Hello from The Veil IDE")\n    return 0\n\nif __name__ == "__main__":\n    raise SystemExit(main())\n```\nVERIFY: Run with Python locally.';
    }},
    { id: 'python_list', re: /\b(python list|for loop python)\b/i, body: function () {
      return 'FILENAME: lists.py\n```python\nitems = ["alpha", "beta", "gamma"]\nfor i, name in enumerate(items, start=1):\n    print(f"{i}. {name}")\n```\nVERIFY: Run — prints numbered list.';
    }},
    { id: 'json_config', re: /\b(json file|config\.json|settings json)\b/i, body: function () {
      return 'FILENAME: config.json\n```json\n{\n  "appName": "My App",\n  "theme": "dark",\n  "features": {\n    "notifications": true,\n    "beta": false\n  }\n}\n```\nVERIFY: Valid JSON — no lint errors.';
    }},
    { id: 'button_handler', re: /\b(button click|onclick|click handler|when i click)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Button</title><style>' + VEIL_STYLE + 'main{margin:3rem;text-align:center}</style></head>\n<body><main><button id="b">Click</button><p id="msg"></p></main><script>\ndocument.getElementById("b").addEventListener("click", function() {\n  document.getElementById("msg").textContent = "Clicked at " + new Date().toLocaleTimeString();\n});\n<\/script></body></html>\n```\nVERIFY: Click button — time appears.';
    }},
    { id: 'gallery', re: /\b(image gallery|photo gallery|gallery)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Gallery</title><style>' + VEIL_STYLE + '.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;padding:1rem}.gallery img{width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover}</style></head>\n<body><div class="gallery" id="g"></div><script>\n["https://picsum.photos/200?1","https://picsum.photos/200?2","https://picsum.photos/200?3"].forEach(function(src){var img=document.createElement("img");img.src=src;img.alt="";document.getElementById("g").append(img);});\n<\/script></body></html>\n```\nVERIFY: Preview shows image grid.';
    }},
    { id: 'accordion', re: /\b(accordion|expand collapse|faq)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>FAQ</title><style>' + VEIL_STYLE + '.item{border:1px solid rgba(255,255,255,.1);border-radius:8px;margin:8px 0}.head{padding:12px;cursor:pointer;font-weight:700}.body{display:none;padding:0 12px 12px}.item.open .body{display:block}</style></head>\n<body><main style="max-width:520px;margin:2rem auto"><div class="item"><div class="head">Question 1</div><div class="body">Answer one.</div></div><div class="item"><div class="head">Question 2</div><div class="body">Answer two.</div></div></main><script>\ndocument.querySelectorAll(".head").forEach(function(h){h.onclick=function(){h.parentElement.classList.toggle("open");};});\n<\/script></body></html>\n```\nVERIFY: Click questions to expand.';
    }},
    { id: 'nav_bar', re: /\b(navbar|nav bar|navigation menu|header menu)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Nav</title><style>' + VEIL_STYLE + 'nav{display:flex;gap:1rem;padding:1rem 1.5rem;background:#12141f;align-items:center}nav a{color:var(--fg);text-decoration:none}nav a:hover{color:var(--accent)}.logo{font-weight:800;color:var(--accent)}</style></head>\n<body><nav><span class="logo">App</span><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav><main style="padding:2rem"><h1>Content</h1></main></body></html>\n```\nVERIFY: Preview shows nav bar.';
  }},
    { id: 'table_style', re: /\b(style table|data table|html table)\b/i, body: function () {
      return 'FILENAME: index.html\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Table</title><style>' + VEIL_STYLE + 'table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}th{color:var(--accent)}</style></head>\n<body><table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Alex</td><td>Dev</td></tr><tr><td>Sam</td><td>Design</td></tr></tbody></table></body></html>\n```\nVERIFY: Preview shows styled table.';
    }},
    { id: 'try_catch', re: /\b(try catch|error handling|handle errors)\b/i, body: function () {
      return 'FILENAME: errors.js\n```javascript\nasync function safeFetch(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error("HTTP " + res.status);\n    return await res.json();\n  } catch (err) {\n    console.error("Failed:", err.message);\n    return null;\n  }\n}\nsafeFetch("https://jsonplaceholder.typicode.com/todos/1").then(console.log);\n```\nVERIFY: Preview logs result or error.';
    }},
    { id: 'generic_html', re: /\b(make html|build html|create html|html file)\b/i, body: function (req) {
      return RECIPES.find(function(r){ return r.id === 'dark_landing'; }).body(req);
    }},
    { id: 'generic_css', re: /\b(make css|create css|stylesheet)\b/i, body: function () {
      return RECIPES.find(function(r){ return r.id === 'css_reset'; }).body();
    }},
    { id: 'generic_js', re: /\b(write javascript|create js|js file)\b/i, body: function () {
      return RECIPES.find(function(r){ return r.id === 'hello_js'; }).body();
    }}
  ];

  // Pre-seeded solutions — searchable from day one (like built-in memory)
  var SEEDS = [
    { prompt: 'todo list app save tasks', file: 'index.html', recipeId: 'todo_app' },
    { prompt: 'button counter clicks', file: 'index.html', recipeId: 'click_counter' },
    { prompt: 'simple calculator', file: 'index.html', recipeId: 'calculator' },
    { prompt: 'contact form name email', file: 'index.html', recipeId: 'contact_form' },
    { prompt: 'dark landing page', file: 'index.html', recipeId: 'dark_landing' },
    { prompt: 'fetch json api', file: 'api.js', recipeId: 'fetch_api' },
    { prompt: 'local storage save data', file: 'storage.js', recipeId: 'local_storage' },
    { prompt: 'tabs switch panels', file: 'index.html', recipeId: 'tabs_ui' },
    { prompt: 'modal popup dialog', file: 'index.html', recipeId: 'modal' },
    { prompt: 'stopwatch timer', file: 'index.html', recipeId: 'timer' },
    { prompt: 'flexbox layout css', file: 'layout.css', recipeId: 'css_flex' },
    { prompt: 'python hello world', file: 'main.py', recipeId: 'python_hello' },
    { prompt: 'image gallery grid', file: 'index.html', recipeId: 'gallery' },
    { prompt: 'navigation bar header', file: 'index.html', recipeId: 'nav_bar' },
    { prompt: 'accordion faq expand', file: 'index.html', recipeId: 'accordion' },
    { prompt: 'debounce search input', file: 'index.html', recipeId: 'debounce' },
    { prompt: 'css card component', file: 'card.css', recipeId: 'css_card' },
    { prompt: 'try catch error handling', file: 'errors.js', recipeId: 'try_catch' },
    { prompt: 'array map filter reduce', file: 'arrays.js', recipeId: 'array_methods' },
    { prompt: 'styled data table', file: 'index.html', recipeId: 'table_style' }
  ];

  // Resolve seed code from recipes
  SEEDS.forEach(function (seed) {
    var recipe = RECIPES.find(function (r) { return r.id === seed.recipeId; });
    if (!recipe) return;
    try {
      var out = recipe.body(seed.prompt);
      var m = out.match(/```[\w]*\n([\s\S]*?)```/);
      seed.code = m ? m[1].trim() : '';
    } catch (e) { seed.code = ''; }
  });

  window.VEIL_CODING_STARTER_PACK = {
    recipes: RECIPES,
    seeds: SEEDS.filter(function (s) { return s.code; }),
    version: 1,
    recipeCount: RECIPES.length,
    seedCount: SEEDS.length
  };
})();
