const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'local-db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 8787;

function seedPlayers(){
  var out = {};
  function add(id, name, lot, order){
    out[id] = { name: name, lot: lot, order: order, status: 'queued', soldTo: null, price: null };
  }
  [
    ['Karthick Selvaraj'], ['Pranav S Khajanchi'], ['Vinod C R'], ['Sachith D R'], ['Yasar Arafath MH'], ['Harish Kumar J']
  ].forEach(function(p, i){ add('lot1-'+slug(p[0]), p[0], 'lot1', i); });
  [
    ['Kunal Mahesh Babaria'], ['Fakruddin'], ['Sivanand Ganesan'], ['Shailesh Maurya'], ['V Gurumoorthi'], ['Maruthu Pandian'],
    ['Arunkumar Dorairaj'], ['Arun Kumar Vijayaraj'], ['Satheesh Kumar'], ['B Chandrabose'], ['Atharsh S S'], ['Nischal']
  ].forEach(function(p, i){ add('lot2-'+slug(p[0]), p[0], 'lot2', i); });
  [
    ['Yuvan Kumar C'], ['Prasanna Kumar'], ['Sreekanth S'], ['Vishnu Sreenivasa'], ['Ajay Chakravarthi'], ['Srikanth Ramesh']
  ].forEach(function(p, i){ add('lot3-'+slug(p[0]), p[0], 'lot3', i); });
  [
    ['Varun Sai Vellore Nagraj'], ['Haswin M'], ['Jenson Rodrigues'], ['Pradeep K B'], ['Dhanu Tadaga Annayya'], ['Krishnan']
  ].forEach(function(p, i){ add('lot4-'+slug(p[0]), p[0], 'lot4', i); });
  [
    ['Jagadesh Ram'], ['Vinoth G'], ['Sathyanarayana Murthy Sista'], ['Suresh Balaji Paulraj'], ['Ramtirth Joglekar'], ['Jayamohan S'],
    ['Jitin Jacob'], ['SM Shashank'], ['Balaji Annamalai'], ['Ravindra Kumar'], ['Pravin Nandkumar Zende'], ['Nitin Sharma']
  ].forEach(function(p, i){ add('lot5-'+slug(p[0]), p[0], 'lot5', i); });
  [
    ['Dristi'], ['Usha'], ['Neeniya'], ['Priyanshi'], ['Pratibha']
  ].forEach(function(p, i){ add('lot6-'+slug(p[0]), p[0], 'lot6', i); });
  return out;
}
function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

function seedTeams(){
  var defs = [
    ['ashwin-selva','Ashwin Selva','t-blue','9257'],
    ['ajay-p','Ajay P','t-orange','5078'],
    ['s-balamurugan','S Balamurugan','t-green','8510'],
    ['ajith-lazer','Ajith Lazer','t-purple','1289'],
    ['gopinath-ragavan','Gopinath Ragavan','t-teal','8195'],
    ['punith-g','Punith G','t-amber','5634']
  ];
  var out = {};
  defs.forEach(function(d, i){
    out[d[0]] = {
      name: d[1], order: i, color: d[2], purseTotal: 8000, purseSpent: 0,
      roster: [{ playerId: 'captain', name: d[1], price: 0, lot: 'captain' }],
      password: d[3]
    };
  });
  return out;
}

function defaultStore(){
  return {
    config: {
      main: {
        increment: 200,
        lotOrder: ['lot3','lot1','lot2','lot5','lot4','lot6'],
        adminPassword: '2363',
        lots: {
          lot1: { label:'Lot 1', basePrice:500, quotaPerTeam:1, icon:'medal', tierName:'Elite Picks' },
          lot2: { label:'Lot 2', basePrice:100, quotaPerTeam:2, icon:'star', tierName:'Prime Picks' },
          lot3: { label:'Lot 3', basePrice:1000, quotaPerTeam:1, icon:'trophy', tierName:'Marquee Players' },
          lot4: { label:'Lot 4', basePrice:100, quotaPerTeam:1, icon:'flag', tierName:'Value Picks' },
          lot5: { label:'Lot 5', basePrice:100, quotaPerTeam:2, icon:'shield', tierName:'Rising Talent' },
          lot6: { label:"Lot 6 · Women", basePrice:100, quotaPerTeam:1, icon:'venus', tierName:"Women's Elite" }
        }
      }
    },
    teams: seedTeams(),
    players: seedPlayers(),
    auction: {
      state: { status:'not_started', currentPlayerId:null, currentBid:0, currentBidTeamId:null, bidHistory:[], lastPlayerId:null, lastResolution:null },
      undo: { type:null, description:null }
    },
    activity: { log: { entries: [] } }
  };
}

var store;
try {
  store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log('Loaded existing local-db.json');
} catch(e){
  store = defaultStore();
  console.log('Starting with a fresh seeded store');
}

function persist(){
  fs.writeFile(DB_FILE, JSON.stringify(store), function(){});
}

var sseClients = [];
function broadcastDoc(collection, id){
  var payload = 'data: ' + JSON.stringify({ type:'doc', collection: collection, id: id, data: store[collection][id] }) + '\n\n';
  sseClients.forEach(function(res){ try{ res.write(payload); }catch(e){} });
}

function deepMerge(target, patch){
  Object.keys(patch).forEach(function(k){
    var v = patch[k];
    if(v && typeof v==='object' && !Array.isArray(v) && target[k] && typeof target[k]==='object' && !Array.isArray(target[k])){
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  });
}

function applyWrite(op, fullPath, data){
  var parts = fullPath.split('/');
  var collection = parts[0], id = parts.slice(1).join('/');
  if(!store[collection]) store[collection] = {};
  if(op === 'set'){
    store[collection][id] = data;
  } else if(op === 'update'){
    var cur = store[collection][id] || {};
    deepMerge(cur, data);
    store[collection][id] = cur;
  } else {
    throw new Error('unknown op');
  }
  persist();
  broadcastDoc(collection, id);
}

var MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };

var server = http.createServer(function(req, res){
  if(req.method === 'GET' && req.url === '/api/stream'){
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('data: ' + JSON.stringify({ type:'full', store: store }) + '\n\n');
    sseClients.push(res);
    req.on('close', function(){ sseClients = sseClients.filter(function(c){ return c !== res; }); });
    return;
  }
  if(req.method === 'POST' && req.url === '/api/write'){
    var body = '';
    req.on('data', function(chunk){ body += chunk; });
    req.on('end', function(){
      try{
        var msg = JSON.parse(body);
        applyWrite(msg.op, msg.path, msg.data);
        res.writeHead(200, { 'Content-Type':'application/json' });
        res.end('{"ok":true}');
      }catch(e){
        res.writeHead(400, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ ok:false, error:String(e && e.message || e) }));
      }
    });
    return;
  }
  var reqPath = req.url === '/' ? '/index.html' : req.url;
  var filePath = path.join(PUBLIC_DIR, path.normalize(reqPath));
  if(filePath.indexOf(PUBLIC_DIR) !== 0){ res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, function(err, data){
    if(err){ res.writeHead(404); res.end('Not found'); return; }
    var ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

setInterval(function(){
  sseClients.forEach(function(res){ try{ res.write(': keepalive\n\n'); }catch(e){} });
}, 20000);

server.listen(PORT, function(){
  console.log('Corporate Premier League auction server running on http://localhost:' + PORT);
});
