import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import useAuth from "./hooks/useAuth";
import useComplaints from "./hooks/useComplaints";

var DEPTS = ["แผนกเภสัชกรรม","แผนกผู้ป่วยนอก (OPD)","แผนกผู้ป่วยใน (IPD)","แผนกฉุกเฉิน (ER)","แผนกรังสีวิทยา","แผนกเวชระเบียน","แผนกการเงิน","แผนกห้องปฏิบัติการ (LAB)","แผนกกายภาพบำบัด","แผนกโภชนาการ","แผนกซักฟอก","แผนกยานพาหนะ","แผนกบริหารทั่วไป","แผนกเทคโนโลยีสารสนเทศ (IT)"];
var STAFF = ["นพ.สมชาย ใจดี","พญ.สมหญิง รักษาดี","ภก.กฤษณกวินทร์ ทำดี","นส.วิภา จัดการเก่ง","นาย.ประเสริฐ บริหารดี","พว.สุนีย์ ดูแลดี"];
var SEV = [{level:1,label:"ระดับ 1",desc:"บ่น/เสนอแนะ/เล่าให้ฟัง",color:"#10b981",impact:"ไม่รุนแรง",time:"ภายใน 3 วันทำการ"},{level:2,label:"ระดับ 2",desc:"ตำหนิ/ต่อว่า/ร้องทุกข์",color:"#f59e0b",impact:"มีความเสี่ยงสูงต่อการเกิดความรุนแรง",time:"ภายใน 72 ชั่วโมง"},{level:3,label:"ระดับ 3",desc:"ด่าทอ/ขู่จะฟ้อง/ทำร้ายร่างกาย",color:"#ef4444",impact:"รุนแรง",time:"ภายใน 6 ชั่วโมง"}];
var STS = [{value:"new",label:"รับเรื่องใหม่",color:"#6366f1"},{value:"investigating",label:"กำลังตรวจสอบ",color:"#f59e0b"},{value:"in_progress",label:"กำลังดำเนินการ",color:"#a855f7"},{value:"resolved",label:"แก้ไขแล้ว",color:"#10b981"},{value:"closed",label:"ปิดเรื่อง",color:"#64748b"}];
var CHANNELS = ["Walk-in","โทรศัพท์","LINE","Facebook","Email","จดหมาย","กล่องรับความคิดเห็น","เว็บไซต์","อื่นๆ"];
var TYPES = ["คุณภาพการรักษา","การบริการ","การรอคอย","สิ่งแวดล้อม/สถานที่","ค่าใช้จ่าย","อื่นๆ"];
var PIE_COLORS = ["#6366f1","#f59e0b","#a855f7","#10b981","#64748b","#ef4444","#06b6d4","#ec4899"];

function getAutoStatus(c){if(c.res&&(c.res.actions||c.res.result))return "resolved";if(c.inv&&(c.inv.facts||c.inv.root))return "in_progress";return "investigating";}
function fmtDate(d){if(!d)return"-";var p=d.split("-");if(p.length===3)return p[2]+"/"+p[1]+"/"+p[0];return d;}
function daysSince(d){if(!d)return"-";try{var p=d.split("-");var yr=parseInt(p[0]);if(yr>2500)yr-=543;var dt=new Date(yr,parseInt(p[1])-1,parseInt(p[2]));var now=new Date();var diff=Math.floor((now-dt)/(1000*60*60*24));return diff>=0?diff:0;}catch(e){return"-";}}
function genId(){return "CMP-"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).substr(2,4).toUpperCase();}

function firebaseErrorThai(code){
  var map = {
    "auth/email-already-in-use":"อีเมลนี้ถูกใช้งานแล้ว",
    "auth/invalid-email":"รูปแบบอีเมลไม่ถูกต้อง",
    "auth/user-disabled":"บัญชีนี้ถูกระงับ",
    "auth/user-not-found":"ไม่พบบัญชีผู้ใช้นี้",
    "auth/wrong-password":"รหัสผ่านไม่ถูกต้อง",
    "auth/weak-password":"รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/too-many-requests":"มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่",
    "auth/network-request-failed":"ไม่สามารถเชื่อมต่อเครือข่ายได้",
    "auth/invalid-credential":"อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  };
  return map[code] || "เกิดข้อผิดพลาด: " + code;
}

/* ========== Sub-components ========== */

function Ico({name}){
  var icons = {"dashboard":"📊","add":"➕","list":"📋","book":"📖","line":"💬","users":"👥","logout":"🚪","search":"🔍","filter":"🔽","bell":"🔔","settings":"⚙️","edit":"✏️","trash":"🗑️","eye":"👁️","save":"💾","back":"◀️","chevron-down":"▼","chevron-up":"▲","check":"✅","x":"❌","alert":"⚠️","clock":"🕐","user":"👤","hospital":"🏥","chart":"📈","file":"📄","phone":"📞","mail":"📧","star":"⭐","flag":"🚩","folder":"📁","info":"ℹ️","home":"🏠","menu":"☰","close":"✕","plus":"＋","minus":"−","arrow-right":"→","arrow-left":"←","calendar":"📅","location":"📍","send":"📤","download":"📥","upload":"📤","refresh":"🔄","lock":"🔒","unlock":"🔓","link":"🔗","print":"🖨️","expand":"⬜","collapse":"🔲"};
  return React.createElement("span",{style:{fontSize:"inherit"}},icons[name]||"📄");
}

function Badge({children,color}){
  return React.createElement("span",{style:{display:"inline-block",padding:"2px 10px",borderRadius:12,fontSize:11,fontWeight:700,color:"#fff",background:color||"#6366f1"}},children);
}

function SBadge({s}){
  var st = STS.find(function(x){return x.value===s;});
  return React.createElement(Badge,{color:st?st.color:"#94a3b8"},st?st.label:s);
}

function LBadge({level}){
  var sv = SEV.find(function(x){return x.level===level;});
  return React.createElement(Badge,{color:sv?sv.color:"#94a3b8"},sv?sv.label:"ระดับ "+level);
}

function Card({title,icon,children,style}){
  return React.createElement("div",{style:Object.assign({background:"#fff",borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:16,overflow:"hidden"},style||{})},
    title ? React.createElement("div",{style:{padding:"14px 20px",background:"#1a5276",color:"#fff",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}},icon&&React.createElement(Ico,{name:icon}),title) : null,
    React.createElement("div",{style:{padding:20}},children)
  );
}

function Inp({label,required,type,value,onChange,placeholder,disabled,style}){
  var ty = type||"text";
  return React.createElement("div",{style:Object.assign({marginBottom:14},style||{})},
    label && React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5}},label,required&&React.createElement("span",{style:{color:"#ef4444"}}," *")),
    ty==="textarea"
      ? React.createElement("textarea",{value:value||"",onChange:function(e){onChange&&onChange(e.target.value);},placeholder:placeholder,disabled:disabled,style:{width:"100%",padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit",minHeight:80,resize:"vertical"}})
      : React.createElement("input",{type:ty,value:value||"",onChange:function(e){onChange&&onChange(e.target.value);},placeholder:placeholder,disabled:disabled,style:{width:"100%",padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}})
  );
}

function SearchSel({label,required,options,value,onChange,placeholder}){
  var _s = useState("");
  var q = _s[0]; var setQ = _s[1];
  var _o = useState(false);
  var open = _o[0]; var setOpen = _o[1];
  var filtered = options.filter(function(o){return o.toLowerCase().includes(q.toLowerCase());});
  return React.createElement("div",{style:{marginBottom:14,position:"relative"}},
    label && React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5}},label,required&&React.createElement("span",{style:{color:"#ef4444"}}," *")),
    React.createElement("input",{type:"text",value:open?q:(value||""),
      onFocus:function(){setOpen(true);setQ(value||"");},
      onChange:function(e){setQ(e.target.value);setOpen(true);},
      placeholder:placeholder||"พิมพ์เพื่อค้นหา...",
      style:{width:"100%",padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}
    }),
    open && React.createElement("div",{style:{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #dce1e8",borderRadius:6,maxHeight:200,overflowY:"auto",zIndex:1000,boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}},
      filtered.length===0
        ? React.createElement("div",{style:{padding:10,fontSize:12,color:"#94a3b8"}},"ไม่พบรายการ")
        : filtered.map(function(o,i){
            return React.createElement("div",{key:i,onClick:function(){onChange&&onChange(o);setOpen(false);setQ("");},style:{padding:"8px 12px",fontSize:13,cursor:"pointer",background:o===value?"#eff6ff":"transparent"}},o);
          })
    )
  );
}

function TagSel({label,options,value,onChange}){
  var val = value || [];
  return React.createElement("div",{style:{marginBottom:14}},
    label && React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5}},label),
    React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},
      options.map(function(o,i){
        var sel = val.includes(o);
        return React.createElement("span",{key:i,onClick:function(){
          if(sel){onChange&&onChange(val.filter(function(v){return v!==o;}));}
          else{onChange&&onChange(val.concat([o]));}
        },style:{padding:"4px 12px",border:"2px solid "+(sel?"#1a5276":"#dce1e8"),borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:sel?"#1a5276":"transparent",color:sel?"#fff":"#2c3e50",transition:"all 0.2s"}},o);
      })
    )
  );
}

function Btn({children,variant,size,onClick,disabled,style}){
  var colors = {primary:{bg:"#1a5276",c:"#fff"},success:{bg:"#27ae60",c:"#fff"},warning:{bg:"#f39c12",c:"#fff"},danger:{bg:"#ef4444",c:"#fff"},outline:{bg:"transparent",c:"#2c3e50",border:"1.5px solid #dce1e8"}};
  var v = colors[variant||"primary"]||colors.primary;
  return React.createElement("button",{onClick:onClick,disabled:disabled,style:Object.assign({padding:size==="sm"?"5px 12px":"8px 16px",border:v.border||"none",borderRadius:6,fontSize:size==="sm"?12:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",background:v.bg,color:v.c,transition:"all 0.2s"},style||{})},children);
}

/* ========== LoginPage ========== */

function LoginPage({onLogin,authHook}){
  var _e = useState(""); var email = _e[0]; var setEmail = _e[1];
  var _p = useState(""); var pw = _p[0]; var setPw = _p[1];
  var _er = useState(""); var err = _er[0]; var setErr = _er[1];
  var _ld = useState(false); var ld = _ld[0]; var setLd = _ld[1];
  var _m = useState("login"); var mode = _m[0]; var setMode = _m[1];

  function handleSubmit(e){
    e.preventDefault();
    setErr("");
    if(!email||!pw){setErr("กรุณากรอกอีเมลและรหัสผ่าน");return;}
    if(!email.endsWith("@up.ac.th")){setErr("อนุญาตเฉพาะอีเมล @up.ac.th เท่านั้น");return;}
    setLd(true);
    var action = mode==="login" ? authHook.login(email,pw) : authHook.register(email,pw);
    action.then(function(){
      setLd(false);
    }).catch(function(error){
      setLd(false);
      setErr(firebaseErrorThai(error.code));
    });
  }

  return React.createElement("div",{style:{minHeight:"100vh",background:"linear-gradient(135deg,#0e2f44 0%,#1a5276 50%,#2980b9 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}},
    React.createElement("div",{style:{background:"#fff",borderRadius:16,padding:40,width:420,maxWidth:"90vw",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}},
      React.createElement("div",{style:{textAlign:"center",marginBottom:30}},
        React.createElement("div",{style:{fontSize:48,marginBottom:8}},"🏥"),
        React.createElement("h1",{style:{fontSize:22,fontWeight:700,color:"#1a5276",marginBottom:4}},"ระบบจัดการข้อร้องเรียน"),
        React.createElement("p",{style:{fontSize:13,color:"#7f8c8d"}},"โรงพยาบาลมหาวิทยาลัยพะเยา")
      ),
      React.createElement("form",{onSubmit:handleSubmit},
        React.createElement("div",{style:{marginBottom:16}},
          React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5,color:"#2c3e50"}},"อีเมล (@up.ac.th)"),
          React.createElement("input",{type:"email",value:email,onChange:function(e){setEmail(e.target.value);},placeholder:"email@up.ac.th",style:{width:"100%",padding:"10px 14px",border:"1.5px solid #dce1e8",borderRadius:8,fontSize:14,fontFamily:"inherit"}})
        ),
        React.createElement("div",{style:{marginBottom:16}},
          React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5,color:"#2c3e50"}},"รหัสผ่าน"),
          React.createElement("input",{type:"password",value:pw,onChange:function(e){setPw(e.target.value);},placeholder:"รหัสผ่าน",style:{width:"100%",padding:"10px 14px",border:"1.5px solid #dce1e8",borderRadius:8,fontSize:14,fontFamily:"inherit"}})
        ),
        err && React.createElement("div",{style:{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#dc2626"}},err),
        React.createElement("button",{type:"submit",disabled:ld,style:{width:"100%",padding:"12px",background:"#1a5276",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:ld?"not-allowed":"pointer",opacity:ld?0.7:1,fontFamily:"inherit",marginBottom:12}},ld?"กำลังดำเนินการ...":(mode==="login"?"เข้าสู่ระบบ":"ลงทะเบียน")),
        React.createElement("div",{style:{textAlign:"center"}},
          React.createElement("span",{style:{fontSize:13,color:"#7f8c8d"}},mode==="login"?"ยังไม่มีบัญชี? ":"มีบัญชีแล้ว? "),
          React.createElement("span",{onClick:function(){setMode(mode==="login"?"register":"login");setErr("");},style:{fontSize:13,color:"#2980b9",cursor:"pointer",fontWeight:600}},mode==="login"?"ลงทะเบียน":"เข้าสู่ระบบ")
        )
      ),
      React.createElement("div",{style:{marginTop:24,padding:16,background:"#f0f9ff",borderRadius:8,border:"1px solid #bae6fd"}},
        React.createElement("div",{style:{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:8}},"บัญชีทดสอบ"),
        React.createElement("div",{style:{fontSize:12,color:"#0c4a6e",lineHeight:1.6}},
          React.createElement("div",null,"👨‍💼 Admin: admin@up.ac.th / 123456"),
          React.createElement("div",null,"👤 User: user@up.ac.th / 123456")
        )
      )
    )
  );
}

/* ========== Sidebar ========== */

function Sidebar({page,setPage,user,onLogout,complaints}){
  var _c = useState(false);
  var collapsed = _c[0]; var setCollapsed = _c[1];
  var newCount = complaints.filter(function(c){return c.status==="new";}).length;

  var navItems = [
    {id:"section",label:"เมนูหลัก"},
    {id:"dash",icon:"dashboard",label:"แดชบอร์ด"},
    {id:"new",icon:"add",label:"บันทึกเรื่องร้องเรียน"},
    {id:"reg",icon:"list",label:"ทะเบียนเรื่องร้องเรียน",badge:newCount||null},
    {id:"section2",label:"ตั้งค่า"},
    {id:"guide",icon:"book",label:"แนวทางปฏิบัติ"},
    {id:"line",icon:"line",label:"ตั้งค่า LINE Notify"},
    {id:"users",icon:"users",label:"จัดการผู้ใช้"},
  ];

  return React.createElement("div",{style:{width:collapsed?60:260,minWidth:collapsed?60:260,background:"#0e2f44",color:"#ecf0f1",display:"flex",flexDirection:"column",transition:"width 0.25s,min-width 0.25s",zIndex:100}},
    React.createElement("div",{style:{padding:collapsed?"12px 0":"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)",textAlign:collapsed?"center":"left"}},
      !collapsed && React.createElement("h1",{style:{fontSize:15,fontWeight:700,color:"#fff",lineHeight:1.4}},"🏥 ระบบข้อร้องเรียน"),
      !collapsed && React.createElement("div",{style:{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4}},"โรงพยาบาล ม.พะเยา"),
      collapsed && React.createElement("div",{style:{fontSize:20}},"🏥")
    ),
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"8px 0"}},
      navItems.map(function(item,i){
        if(item.id.startsWith("section")){
          if(collapsed)return null;
          return React.createElement("div",{key:i,style:{padding:"8px 20px 4px",fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,0.4)",fontWeight:600}},item.label);
        }
        var isActive = page===item.id||(page==="detail"&&item.id==="reg");
        return React.createElement("div",{key:i,onClick:function(){setPage(item.id);},style:{display:"flex",alignItems:"center",gap:10,padding:collapsed?"10px 0":"10px 20px",cursor:"pointer",fontSize:13,borderLeft:isActive?"3px solid #f39c12":"3px solid transparent",background:isActive?"rgba(255,255,255,0.12)":"transparent",color:isActive?"#fff":"#ecf0f1",fontWeight:isActive?600:400,justifyContent:collapsed?"center":"flex-start",transition:"all 0.2s"}},
          React.createElement("span",{style:{width:20,textAlign:"center",fontSize:16}},React.createElement(Ico,{name:item.icon})),
          !collapsed && React.createElement("span",null,item.label),
          !collapsed && item.badge && React.createElement("span",{style:{marginLeft:"auto",background:"#ef4444",color:"#fff",fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600}},item.badge)
        );
      })
    ),
    !collapsed && React.createElement("div",{style:{padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.1)"}},
      React.createElement("div",{style:{fontSize:12,color:"rgba(255,255,255,0.8)",marginBottom:4}},React.createElement(Ico,{name:"user"})," ",user.name),
      React.createElement("div",{style:{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:8}},user.email),
      React.createElement("div",{onClick:onLogout,style:{fontSize:12,color:"rgba(255,255,255,0.6)",cursor:"pointer",display:"flex",alignItems:"center",gap:6}},React.createElement(Ico,{name:"logout"}),"ออกจากระบบ")
    ),
    React.createElement("div",{onClick:function(){setCollapsed(!collapsed);},style:{padding:8,textAlign:"center",cursor:"pointer",borderTop:"1px solid rgba(255,255,255,0.1)",fontSize:18,color:"rgba(255,255,255,0.6)"}},collapsed?"▶":"◀")
  );
}

/* ========== Dashboard ========== */

function Dash({complaints}){
  var data = complaints;
  var total = data.length;
  var newC = data.filter(function(c){return c.status==="new";}).length;
  var inProg = data.filter(function(c){return c.status==="investigating"||c.status==="in_progress";}).length;
  var resolved = data.filter(function(c){return c.status==="resolved"||c.status==="closed";}).length;
  var sev3 = data.filter(function(c){return c.severity===3;}).length;

  var MO = useMemo(function(){
    var months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    var counts = {};
    months.forEach(function(m){counts[m]=0;});
    data.forEach(function(c){
      if(c.date){
        var parts = c.date.split("-");
        if(parts.length===3){
          var mi = parseInt(parts[1])-1;
          if(mi>=0&&mi<12)counts[months[mi]]++;
        }
      }
    });
    return months.map(function(m){return {name:m,count:counts[m]};});
  },[data]);

  var DP = useMemo(function(){
    var deptCounts = {};
    data.forEach(function(c){
      if(c.dept){
        deptCounts[c.dept] = (deptCounts[c.dept]||0)+1;
      }
    });
    var arr = Object.keys(deptCounts).map(function(d){return {name:d.replace("แผนก",""),count:deptCounts[d]};});
    arr.sort(function(a,b){return b.count-a.count;});
    if(arr.length===0){
      arr = [{name:"เภสัชกรรม",count:5},{name:"OPD",count:8},{name:"IPD",count:3},{name:"ER",count:6},{name:"การเงิน",count:4}];
    }
    return arr.slice(0,8);
  },[data]);

  var PC = useMemo(function(){
    var stCounts = {};
    STS.forEach(function(s){stCounts[s.value]=0;});
    data.forEach(function(c){
      if(stCounts[c.status]!==undefined)stCounts[c.status]++;
    });
    return STS.map(function(s){return {name:s.label,value:stCounts[s.value],color:s.color};}).filter(function(s){return s.value>0;});
  },[data]);

  var SVB = useMemo(function(){
    var sv = {1:0,2:0,3:0};
    data.forEach(function(c){if(c.severity)sv[c.severity]++;});
    return SEV.map(function(s){return {name:s.label,count:sv[s.level],color:s.color};});
  },[data]);

  var stats = [
    {label:"เรื่องทั้งหมด",value:total,color:"#1a5276",icon:"📊"},
    {label:"รับเรื่องใหม่",value:newC,color:"#6366f1",icon:"🆕"},
    {label:"กำลังดำเนินการ",value:inProg,color:"#f59e0b",icon:"⏳"},
    {label:"แก้ไขแล้ว",value:resolved,color:"#10b981",icon:"✅"},
    {label:"ระดับ 3 (รุนแรง)",value:sev3,color:"#ef4444",icon:"🚨"}
  ];

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:16,marginBottom:20}},
      stats.map(function(s,i){
        return React.createElement("div",{key:i,style:{background:"#fff",borderRadius:8,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",borderLeft:"4px solid "+s.color}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:4}},s.label),
              React.createElement("div",{style:{fontSize:28,fontWeight:700,color:s.color}},s.value)
            ),
            React.createElement("div",{style:{fontSize:32,opacity:0.3}},s.icon)
          )
        );
      })
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}},
      React.createElement(Card,{title:"จำนวนเรื่องร้องเรียนรายเดือน",icon:"chart"},
        React.createElement(ResponsiveContainer,{width:"100%",height:280},
          React.createElement(BarChart,{data:MO},
            React.createElement(CartesianGrid,{strokeDasharray:"3 3"}),
            React.createElement(XAxis,{dataKey:"name",fontSize:11}),
            React.createElement(YAxis,{fontSize:11}),
            React.createElement(Tooltip,null),
            React.createElement(Bar,{dataKey:"count",fill:"#1a5276",radius:[4,4,0,0],name:"จำนวน"})
          )
        )
      ),
      React.createElement(Card,{title:"สัดส่วนสถานะ",icon:"chart"},
        React.createElement(ResponsiveContainer,{width:"100%",height:280},
          React.createElement(PieChart,null,
            React.createElement(Pie,{data:PC.length>0?PC:[{name:"ไม่มีข้อมูล",value:1,color:"#e2e8f0"}],cx:"50%",cy:"50%",innerRadius:50,outerRadius:90,paddingAngle:3,dataKey:"value",label:function(p){return p.name+" ("+p.value+")";}},
              (PC.length>0?PC:[{name:"ไม่มีข้อมูล",value:1,color:"#e2e8f0"}]).map(function(entry,index){
                return React.createElement(Cell,{key:index,fill:entry.color});
              })
            ),
            React.createElement(Tooltip,null)
          )
        )
      )
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}},
      React.createElement(Card,{title:"เรื่องร้องเรียนตามแผนก",icon:"chart"},
        React.createElement(ResponsiveContainer,{width:"100%",height:250},
          React.createElement(BarChart,{data:DP,layout:"vertical"},
            React.createElement(CartesianGrid,{strokeDasharray:"3 3"}),
            React.createElement(XAxis,{type:"number",fontSize:11}),
            React.createElement(YAxis,{type:"category",dataKey:"name",fontSize:11,width:100}),
            React.createElement(Tooltip,null),
            React.createElement(Bar,{dataKey:"count",fill:"#2980b9",radius:[0,4,4,0],name:"จำนวน"})
          )
        )
      ),
      React.createElement(Card,{title:"ระดับความรุนแรง",icon:"alert"},
        React.createElement(ResponsiveContainer,{width:"100%",height:250},
          React.createElement(BarChart,{data:SVB},
            React.createElement(CartesianGrid,{strokeDasharray:"3 3"}),
            React.createElement(XAxis,{dataKey:"name",fontSize:11}),
            React.createElement(YAxis,{fontSize:11}),
            React.createElement(Tooltip,null),
            React.createElement(Bar,{dataKey:"count",name:"จำนวน",radius:[4,4,0,0]},
              SVB.map(function(entry,index){
                return React.createElement(Cell,{key:index,fill:entry.color});
              })
            )
          )
        )
      )
    )
  );
}

/* ========== NewForm ========== */

function NewForm({onSave,onCancel}){
  var _f = useState({
    id:genId(),date:"",channel:"",type:"",complainant_name:"",complainant_phone:"",complainant_addr:"",
    dept:"",severity:1,subject:"",detail:"",staff_involved:[],want:"",status:"new"
  });
  var form = _f[0]; var setForm = _f[1];
  var _sv = useState(false); var saving = _sv[0]; var setSaving = _sv[1];

  function set(k,v){setForm(function(p){var n=Object.assign({},p);n[k]=v;return n;});}

  function handleSave(){
    if(!form.date||!form.dept||!form.subject||!form.detail){alert("กรุณากรอกข้อมูลที่จำเป็น: วันที่, แผนก, เรื่อง, รายละเอียด");return;}
    setSaving(true);
    onSave(form).then(function(){
      setSaving(false);
    }).catch(function(err){
      setSaving(false);
      alert("เกิดข้อผิดพลาด: "+err.message);
    });
  }

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
      React.createElement("h3",{style:{fontSize:16,fontWeight:700}},"📝 บันทึกเรื่องร้องเรียนใหม่"),
      React.createElement("div",{style:{display:"flex",gap:8}},
        React.createElement(Btn,{variant:"outline",onClick:onCancel},"ยกเลิก"),
        React.createElement(Btn,{variant:"success",onClick:handleSave,disabled:saving},saving?"กำลังบันทึก...":"💾 บันทึก")
      )
    ),
    React.createElement(Card,{title:"ข้อมูลทั่วไป",icon:"file"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}},
        React.createElement(Inp,{label:"รหัสเรื่อง",value:form.id,disabled:true}),
        React.createElement(Inp,{label:"วันที่รับเรื่อง",required:true,type:"date",value:form.date,onChange:function(v){set("date",v);}}),
        React.createElement(SearchSel,{label:"ช่องทาง",options:CHANNELS,value:form.channel,onChange:function(v){set("channel",v);}}),
        React.createElement(SearchSel,{label:"ประเภท",options:TYPES,value:form.type,onChange:function(v){set("type",v);}})
      )
    ),
    React.createElement(Card,{title:"ข้อมูลผู้ร้องเรียน",icon:"user"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}},
        React.createElement(Inp,{label:"ชื่อ-สกุล",value:form.complainant_name,onChange:function(v){set("complainant_name",v);},placeholder:"ชื่อผู้ร้องเรียน (ถ้ามี)"}),
        React.createElement(Inp,{label:"เบอร์โทร",value:form.complainant_phone,onChange:function(v){set("complainant_phone",v);},placeholder:"เบอร์โทรศัพท์"}),
        React.createElement(Inp,{label:"ที่อยู่",type:"textarea",value:form.complainant_addr,onChange:function(v){set("complainant_addr",v);},placeholder:"ที่อยู่ (ถ้ามี)",style:{gridColumn:"1/3"}})
      )
    ),
    React.createElement(Card,{title:"รายละเอียดเรื่องร้องเรียน",icon:"edit"},
      React.createElement(SearchSel,{label:"แผนกที่เกี่ยวข้อง",required:true,options:DEPTS,value:form.dept,onChange:function(v){set("dept",v);}}),
      React.createElement("div",{style:{marginBottom:14}},
        React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:8}},"ระดับความรุนแรง ",React.createElement("span",{style:{color:"#ef4444"}},"*")),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}},
          SEV.map(function(s){
            var sel = form.severity===s.level;
            return React.createElement("div",{key:s.level,onClick:function(){set("severity",s.level);},style:{border:"2px solid "+(sel?s.color:"#dce1e8"),borderRadius:8,padding:12,cursor:"pointer",background:sel?s.color+"15":"#fff",transition:"all 0.2s"}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:4}},
                React.createElement("div",{style:{width:12,height:12,borderRadius:"50%",background:s.color}}),
                React.createElement("span",{style:{fontWeight:700,fontSize:13}},s.label)
              ),
              React.createElement("div",{style:{fontSize:11,color:"#7f8c8d"}},s.desc),
              React.createElement("div",{style:{fontSize:11,color:s.color,fontWeight:600,marginTop:4}},"⏱️ ",s.time)
            );
          })
        )
      ),
      React.createElement(Inp,{label:"เรื่อง",required:true,value:form.subject,onChange:function(v){set("subject",v);},placeholder:"หัวข้อเรื่องร้องเรียน"}),
      React.createElement(Inp,{label:"รายละเอียด",required:true,type:"textarea",value:form.detail,onChange:function(v){set("detail",v);},placeholder:"อธิบายรายละเอียดเรื่องร้องเรียน"}),
      React.createElement(TagSel,{label:"เจ้าหน้าที่ที่เกี่ยวข้อง",options:STAFF,value:form.staff_involved,onChange:function(v){set("staff_involved",v);}}),
      React.createElement(Inp,{label:"ความต้องการของผู้ร้องเรียน",type:"textarea",value:form.want,onChange:function(v){set("want",v);},placeholder:"ผู้ร้องเรียนต้องการอะไร"})
    )
  );
}

/* ========== Reg (Registry Table) ========== */

function Reg({complaints,onSelect}){
  var _q = useState(""); var q = _q[0]; var setQ = _q[1];
  var _fs = useState("all"); var fSt = _fs[0]; var setFSt = _fs[1];
  var _fd = useState("all"); var fDp = _fd[0]; var setFDp = _fd[1];
  var _fv = useState("all"); var fSv = _fv[0]; var setFSv = _fv[1];

  var filtered = complaints.filter(function(c){
    var matchQ = !q || (c.subject&&c.subject.includes(q)) || (c.id&&c.id.includes(q)) || (c.complainant_name&&c.complainant_name.includes(q)) || (c.detail&&c.detail.includes(q));
    var matchSt = fSt==="all" || c.status===fSt;
    var matchDp = fDp==="all" || c.dept===fDp;
    var matchSv = fSv==="all" || c.severity===parseInt(fSv);
    return matchQ && matchSt && matchDp && matchSv;
  });

  return React.createElement("div",null,
    React.createElement(Card,{title:"ค้นหาและกรองข้อมูล",icon:"search"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12}},
        React.createElement("input",{type:"text",value:q,onChange:function(e){setQ(e.target.value);},placeholder:"🔍 ค้นหา: รหัส, เรื่อง, ชื่อผู้ร้องเรียน...",style:{padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}}),
        React.createElement("select",{value:fSt,onChange:function(e){setFSt(e.target.value);},style:{padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}},
          React.createElement("option",{value:"all"},"สถานะ: ทั้งหมด"),
          STS.map(function(s){return React.createElement("option",{key:s.value,value:s.value},s.label);})
        ),
        React.createElement("select",{value:fDp,onChange:function(e){setFDp(e.target.value);},style:{padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}},
          React.createElement("option",{value:"all"},"แผนก: ทั้งหมด"),
          DEPTS.map(function(d){return React.createElement("option",{key:d,value:d},d);})
        ),
        React.createElement("select",{value:fSv,onChange:function(e){setFSv(e.target.value);},style:{padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}},
          React.createElement("option",{value:"all"},"ระดับ: ทั้งหมด"),
          SEV.map(function(s){return React.createElement("option",{key:s.level,value:s.level},s.label);})
        )
      )
    ),
    React.createElement("div",{style:{background:"#fff",borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",overflow:"hidden"}},
      React.createElement("div",{style:{padding:"14px 20px",borderBottom:"1px solid #dce1e8",display:"flex",justifyContent:"space-between",alignItems:"center"}},
        React.createElement("span",{style:{fontWeight:700,fontSize:14}},"📋 ทะเบียนเรื่องร้องเรียน"),
        React.createElement("span",{style:{fontSize:12,color:"#7f8c8d"}},"พบ ",filtered.length," รายการ")
      ),
      React.createElement("div",{style:{overflowX:"auto"}},
        React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:13}},
          React.createElement("thead",null,
            React.createElement("tr",{style:{background:"#f8fafc"}},
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"รหัส"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"วันที่"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"เรื่อง"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"แผนก"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"ระดับ"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"สถานะ"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"วัน"),
              React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"จัดการ")
            )
          ),
          React.createElement("tbody",null,
            filtered.length===0
              ? React.createElement("tr",null,React.createElement("td",{colSpan:8,style:{padding:40,textAlign:"center",color:"#94a3b8"}},"ไม่พบข้อมูล"))
              : filtered.map(function(c,i){
                  return React.createElement("tr",{key:c._docId||i,style:{borderBottom:"1px solid #f1f5f9",transition:"background 0.15s",cursor:"pointer"},
                    onClick:function(){onSelect(c);},
                    onMouseEnter:function(e){e.currentTarget.style.background="#f8fafc";},
                    onMouseLeave:function(e){e.currentTarget.style.background="transparent";}
                  },
                    React.createElement("td",{style:{padding:"10px 14px",fontWeight:600,color:"#1a5276"}},c.id),
                    React.createElement("td",{style:{padding:"10px 14px"}},fmtDate(c.date)),
                    React.createElement("td",{style:{padding:"10px 14px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},c.subject),
                    React.createElement("td",{style:{padding:"10px 14px",fontSize:12}},c.dept),
                    React.createElement("td",{style:{padding:"10px 14px",textAlign:"center"}},React.createElement(LBadge,{level:c.severity})),
                    React.createElement("td",{style:{padding:"10px 14px",textAlign:"center"}},React.createElement(SBadge,{s:c.status})),
                    React.createElement("td",{style:{padding:"10px 14px",textAlign:"center",fontSize:12}},daysSince(c.date)," วัน"),
                    React.createElement("td",{style:{padding:"10px 14px",textAlign:"center"}},
                      React.createElement(Btn,{variant:"primary",size:"sm",onClick:function(e){e.stopPropagation();onSelect(c);}},"👁️ ดู")
                    )
                  );
                })
          )
        )
      )
    )
  );
}

/* ========== Detail View ========== */

function Detail({complaint,onBack,onUpdate}){
  var c = complaint;
  var _tab = useState("detail"); var tab = _tab[0]; var setTab = _tab[1];
  var _inv = useState(c.inv||{facts:"",root:"",team:""}); var inv = _inv[0]; var setInv = _inv[1];
  var _res = useState(c.res||{actions:"",result:"",prevention:"",followup:""}); var res = _res[0]; var setRes = _res[1];
  var _saving = useState(false); var saving = _saving[0]; var setSaving = _saving[1];

  function setI(k,v){setInv(function(p){var n=Object.assign({},p);n[k]=v;return n;});}
  function setR(k,v){setRes(function(p){var n=Object.assign({},p);n[k]=v;return n;});}

  function handleSave(){
    var updated = Object.assign({},c,{inv:inv,res:res});
    updated.status = getAutoStatus(updated);
    setSaving(true);
    onUpdate(c._docId,{inv:inv,res:res,status:updated.status}).then(function(){
      setSaving(false);
    }).catch(function(err){
      setSaving(false);
      alert("เกิดข้อผิดพลาด: "+err.message);
    });
  }

  function handleStatusChange(newStatus){
    setSaving(true);
    onUpdate(c._docId,{status:newStatus}).then(function(){
      setSaving(false);
    }).catch(function(err){
      setSaving(false);
      alert("เกิดข้อผิดพลาด: "+err.message);
    });
  }

  var sv = SEV.find(function(s){return s.level===c.severity;});
  var st = STS.find(function(s){return s.value===c.status;});

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:12}},
        React.createElement(Btn,{variant:"outline",onClick:onBack},"◀ กลับ"),
        React.createElement("h3",{style:{fontSize:16,fontWeight:700}},c.id," - ",c.subject)
      ),
      React.createElement("div",{style:{display:"flex",gap:8}},
        React.createElement(Btn,{variant:"success",onClick:handleSave,disabled:saving},saving?"กำลังบันทึก...":"💾 บันทึก"),
        c.status!=="closed" && React.createElement(Btn,{variant:"outline",onClick:function(){handleStatusChange("closed");}},"ปิดเรื่อง")
      )
    ),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}},
      React.createElement("div",{style:{background:"#fff",borderRadius:8,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}},
        React.createElement("div",{style:{fontSize:11,color:"#7f8c8d",marginBottom:4}},"สถานะ"),
        React.createElement("div",null,React.createElement(SBadge,{s:c.status})),
        React.createElement("div",{style:{marginTop:8}},
          React.createElement("select",{value:c.status,onChange:function(e){handleStatusChange(e.target.value);},style:{padding:"6px 10px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:12,fontFamily:"inherit",width:"100%"}},
            STS.map(function(s){return React.createElement("option",{key:s.value,value:s.value},s.label);})
          )
        )
      ),
      React.createElement("div",{style:{background:"#fff",borderRadius:8,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}},
        React.createElement("div",{style:{fontSize:11,color:"#7f8c8d",marginBottom:4}},"ระดับความรุนแรง"),
        React.createElement(LBadge,{level:c.severity}),
        sv && React.createElement("div",{style:{fontSize:11,color:"#7f8c8d",marginTop:4}},sv.desc)
      ),
      React.createElement("div",{style:{background:"#fff",borderRadius:8,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}},
        React.createElement("div",{style:{fontSize:11,color:"#7f8c8d",marginBottom:4}},"ระยะเวลา"),
        React.createElement("div",{style:{fontSize:20,fontWeight:700,color:"#1a5276"}},daysSince(c.date)," วัน"),
        sv && React.createElement("div",{style:{fontSize:11,color:sv.color,fontWeight:600}},"กำหนด: ",sv.time)
      )
    ),

    React.createElement("div",{style:{display:"flex",borderBottom:"2px solid #dce1e8",marginBottom:16,gap:2}},
      ["detail","investigation","resolution"].map(function(t){
        var labels = {detail:"📄 รายละเอียด",investigation:"🔍 การสอบสวน",resolution:"✅ การแก้ไข"};
        return React.createElement("div",{key:t,onClick:function(){setTab(t);},style:{padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer",borderBottom:"2px solid "+(tab===t?"#1a5276":"transparent"),marginBottom:-2,color:tab===t?"#1a5276":"#7f8c8d",borderRadius:"6px 6px 0 0",background:tab===t?"#fff":"transparent",transition:"all 0.2s"}},labels[t]);
      })
    ),

    tab==="detail" && React.createElement("div",null,
      React.createElement(Card,{title:"ข้อมูลทั่วไป",icon:"file"},
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"รหัสเรื่อง"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},c.id)
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"วันที่รับเรื่อง"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},fmtDate(c.date))
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"ช่องทาง"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},c.channel||"-")
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"ประเภท"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},c.type||"-")
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"แผนก"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},c.dept||"-")
          ),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:2}},"ผู้ร้องเรียน"),
            React.createElement("div",{style:{fontSize:14,fontWeight:600}},c.complainant_name||"ไม่ระบุ")
          )
        )
      ),
      React.createElement(Card,{title:"รายละเอียดเรื่องร้องเรียน",icon:"edit"},
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:4}},"เรื่อง"),
          React.createElement("div",{style:{fontSize:15,fontWeight:700}},c.subject)
        ),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:4}},"รายละเอียด"),
          React.createElement("div",{style:{fontSize:13,lineHeight:1.8,background:"#f8fafc",padding:14,borderRadius:6,border:"1px solid #e2e8f0"}},c.detail)
        ),
        c.want && React.createElement("div",{style:{marginBottom:12}},
          React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:4}},"ความต้องการของผู้ร้องเรียน"),
          React.createElement("div",{style:{fontSize:13,background:"#fffbeb",padding:14,borderRadius:6,border:"1px solid #fde68a"}},c.want)
        ),
        c.staff_involved && c.staff_involved.length>0 && React.createElement("div",null,
          React.createElement("div",{style:{fontSize:12,color:"#7f8c8d",marginBottom:4}},"เจ้าหน้าที่ที่เกี่ยวข้อง"),
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},
            c.staff_involved.map(function(s,i){return React.createElement(Badge,{key:i,color:"#2980b9"},s);})
          )
        )
      )
    ),

    tab==="investigation" && React.createElement("div",null,
      React.createElement(Card,{title:"การสอบสวนข้อเท็จจริง",icon:"search"},
        React.createElement(Inp,{label:"ข้อเท็จจริงที่พบ",type:"textarea",value:inv.facts,onChange:function(v){setI("facts",v);},placeholder:"บรรยายข้อเท็จจริงที่ได้จากการสอบสวน"}),
        React.createElement(Inp,{label:"สาเหตุรากเหง้า (Root Cause)",type:"textarea",value:inv.root,onChange:function(v){setI("root",v);},placeholder:"วิเคราะห์สาเหตุที่แท้จริงของปัญหา"}),
        React.createElement(Inp,{label:"ทีมสอบสวน",value:inv.team,onChange:function(v){setI("team",v);},placeholder:"รายชื่อทีมสอบสวน"})
      )
    ),

    tab==="resolution" && React.createElement("div",null,
      React.createElement(Card,{title:"การแก้ไขและป้องกัน",icon:"check"},
        React.createElement(Inp,{label:"มาตรการแก้ไข",type:"textarea",value:res.actions,onChange:function(v){setR("actions",v);},placeholder:"อธิบายมาตรการแก้ไขที่ดำเนินการ"}),
        React.createElement(Inp,{label:"ผลลัพธ์",type:"textarea",value:res.result,onChange:function(v){setR("result",v);},placeholder:"ผลลัพธ์จากการแก้ไข"}),
        React.createElement(Inp,{label:"การป้องกันไม่ให้เกิดซ้ำ",type:"textarea",value:res.prevention,onChange:function(v){setR("prevention",v);},placeholder:"มาตรการป้องกันการเกิดซ้ำ"}),
        React.createElement(Inp,{label:"การติดตามผล",type:"textarea",value:res.followup,onChange:function(v){setR("followup",v);},placeholder:"แผนการติดตามผล"})
      )
    )
  );
}

/* ========== Guide ========== */

function Guide(){
  return React.createElement("div",null,
    React.createElement("h3",{style:{fontSize:18,fontWeight:700,marginBottom:16}},"📖 แนวทางปฏิบัติการจัดการข้อร้องเรียน"),
    React.createElement(Card,{title:"ขั้นตอนการรับเรื่องร้องเรียน",icon:"file"},
      React.createElement("div",{style:{lineHeight:2,fontSize:13}},
        React.createElement("div",{style:{fontWeight:700,marginBottom:8,color:"#1a5276"}},"1. การรับเรื่อง"),
        React.createElement("ul",{style:{paddingLeft:20,marginBottom:16}},
          React.createElement("li",null,"รับฟังผู้ร้องเรียนด้วยความใส่ใจและเคารพ"),
          React.createElement("li",null,"บันทึกข้อมูลลงในระบบทันที"),
          React.createElement("li",null,"แจ้งรหัสเรื่องให้ผู้ร้องเรียนทราบ"),
          React.createElement("li",null,"ประเมินระดับความรุนแรงเบื้องต้น")
        ),
        React.createElement("div",{style:{fontWeight:700,marginBottom:8,color:"#1a5276"}},"2. การคัดกรองและจำแนก"),
        React.createElement("ul",{style:{paddingLeft:20,marginBottom:16}},
          React.createElement("li",null,"ระดับ 1 (บ่น/เสนอแนะ): ดำเนินการภายใน 3 วันทำการ"),
          React.createElement("li",null,"ระดับ 2 (ตำหนิ/ร้องทุกข์): ดำเนินการภายใน 72 ชั่วโมง"),
          React.createElement("li",null,"ระดับ 3 (รุนแรง/ขู่ฟ้อง): ดำเนินการภายใน 6 ชั่วโมง")
        ),
        React.createElement("div",{style:{fontWeight:700,marginBottom:8,color:"#1a5276"}},"3. การสอบสวนข้อเท็จจริง"),
        React.createElement("ul",{style:{paddingLeft:20,marginBottom:16}},
          React.createElement("li",null,"รวบรวมข้อมูลจากทุกฝ่ายที่เกี่ยวข้อง"),
          React.createElement("li",null,"สัมภาษณ์ผู้เกี่ยวข้อง"),
          React.createElement("li",null,"ตรวจสอบเอกสารและหลักฐาน"),
          React.createElement("li",null,"วิเคราะห์สาเหตุรากเหง้า (Root Cause Analysis)")
        ),
        React.createElement("div",{style:{fontWeight:700,marginBottom:8,color:"#1a5276"}},"4. การแก้ไขและตอบกลับ"),
        React.createElement("ul",{style:{paddingLeft:20,marginBottom:16}},
          React.createElement("li",null,"กำหนดมาตรการแก้ไข"),
          React.createElement("li",null,"ดำเนินการแก้ไข"),
          React.createElement("li",null,"แจ้งผลให้ผู้ร้องเรียนทราบ"),
          React.createElement("li",null,"ติดตามผลการแก้ไข")
        ),
        React.createElement("div",{style:{fontWeight:700,marginBottom:8,color:"#1a5276"}},"5. การป้องกันและปรับปรุง"),
        React.createElement("ul",{style:{paddingLeft:20}},
          React.createElement("li",null,"กำหนดมาตรการป้องกันการเกิดซ้ำ"),
          React.createElement("li",null,"ปรับปรุงกระบวนการทำงาน"),
          React.createElement("li",null,"รายงานสรุปผลต่อผู้บริหาร"),
          React.createElement("li",null,"ทบทวนและปรับปรุงแนวทางปฏิบัติ")
        )
      )
    ),
    React.createElement(Card,{title:"ระดับความรุนแรง",icon:"alert"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}},
        SEV.map(function(s){
          return React.createElement("div",{key:s.level,style:{border:"2px solid "+s.color,borderRadius:8,padding:16,background:s.color+"10"}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
              React.createElement("div",{style:{width:16,height:16,borderRadius:"50%",background:s.color}}),
              React.createElement("span",{style:{fontWeight:700,fontSize:15}},s.label)
            ),
            React.createElement("div",{style:{fontSize:13,marginBottom:8}},React.createElement("strong",null,"ลักษณะ: "),s.desc),
            React.createElement("div",{style:{fontSize:13,marginBottom:8}},React.createElement("strong",null,"ผลกระทบ: "),s.impact),
            React.createElement("div",{style:{fontSize:13,color:s.color,fontWeight:600}},"⏱️ ระยะเวลาดำเนินการ: ",s.time)
          );
        })
      )
    ),
    React.createElement(Card,{title:"ช่องทางรับเรื่องร้องเรียน",icon:"phone"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}},
        CHANNELS.map(function(ch,i){
          var icons = ["🚶","📞","💬","📘","📧","✉️","📦","🌐","📋"];
          return React.createElement("div",{key:i,style:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:12,textAlign:"center",fontSize:13}},
            React.createElement("div",{style:{fontSize:24,marginBottom:4}},icons[i]||"📋"),
            ch
          );
        })
      )
    )
  );
}

/* ========== LinePage ========== */

function LinePage(){
  var _t = useState(""); var token = _t[0]; var setToken = _t[1];
  var _en = useState(true); var enabled = _en[0]; var setEnabled = _en[1];
  var _nf = useState({new_complaint:true,status_change:true,sev3:true,daily_summary:false});
  var nf = _nf[0]; var setNf = _nf[1];

  function toggleNf(k){setNf(function(p){var n=Object.assign({},p);n[k]=!n[k];return n;});}

  return React.createElement("div",null,
    React.createElement("h3",{style:{fontSize:18,fontWeight:700,marginBottom:16}},"💬 ตั้งค่า LINE Notify"),
    React.createElement(Card,{title:"การเชื่อมต่อ LINE Notify",icon:"link"},
      React.createElement("div",{style:{marginBottom:16}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:12}},
          React.createElement("label",{style:{fontSize:13,fontWeight:600}},"เปิดใช้งาน LINE Notify"),
          React.createElement("div",{onClick:function(){setEnabled(!enabled);},style:{width:44,height:24,borderRadius:12,background:enabled?"#10b981":"#cbd5e1",cursor:"pointer",position:"relative",transition:"background 0.2s"}},
            React.createElement("div",{style:{width:20,height:20,borderRadius:10,background:"#fff",position:"absolute",top:2,left:enabled?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}})
          )
        ),
        React.createElement(Inp,{label:"LINE Notify Token",value:token,onChange:setToken,placeholder:"กรอก LINE Notify Token"}),
        React.createElement("div",{style:{fontSize:11,color:"#7f8c8d",marginTop:4}},
          "รับ Token ได้ที่ ",
          React.createElement("a",{href:"https://notify-bot.line.me/",target:"_blank",style:{color:"#2980b9"}},"https://notify-bot.line.me/")
        )
      ),
      React.createElement(Btn,{variant:"primary",onClick:function(){alert("บันทึกการตั้งค่าเรียบร้อย");}},"💾 บันทึกการตั้งค่า")
    ),
    React.createElement(Card,{title:"การแจ้งเตือน",icon:"bell"},
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:12}},
        [{key:"new_complaint",label:"แจ้งเตือนเมื่อมีเรื่องร้องเรียนใหม่",desc:"ส่งการแจ้งเตือนทุกครั้งที่มีการบันทึกเรื่องร้องเรียนใหม่"},
         {key:"status_change",label:"แจ้งเตือนเมื่อสถานะเปลี่ยน",desc:"ส่งการแจ้งเตือนเมื่อมีการเปลี่ยนสถานะเรื่องร้องเรียน"},
         {key:"sev3",label:"แจ้งเตือนเรื่องระดับ 3 (รุนแรง)",desc:"ส่งการแจ้งเตือนพิเศษเมื่อมีเรื่องร้องเรียนระดับ 3"},
         {key:"daily_summary",label:"สรุปรายวัน",desc:"ส่งสรุปเรื่องร้องเรียนประจำวันเวลา 08:00 น."}
        ].map(function(item){
          return React.createElement("div",{key:item.key,style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:14,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontSize:13,fontWeight:600}},item.label),
              React.createElement("div",{style:{fontSize:11,color:"#7f8c8d"}},item.desc)
            ),
            React.createElement("div",{onClick:function(){toggleNf(item.key);},style:{width:44,height:24,borderRadius:12,background:nf[item.key]?"#10b981":"#cbd5e1",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}},
              React.createElement("div",{style:{width:20,height:20,borderRadius:10,background:"#fff",position:"absolute",top:2,left:nf[item.key]?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}})
            )
          );
        })
      )
    ),
    React.createElement(Card,{title:"ทดสอบการแจ้งเตือน",icon:"send"},
      React.createElement("p",{style:{fontSize:13,color:"#7f8c8d",marginBottom:12}},"ส่งข้อความทดสอบไปยัง LINE Notify เพื่อตรวจสอบการเชื่อมต่อ"),
      React.createElement(Btn,{variant:"warning",onClick:function(){alert("ส่งข้อความทดสอบเรียบร้อย (จำลอง)");}},"📤 ส่งข้อความทดสอบ")
    )
  );
}

/* ========== UsersPage ========== */

function UsersPage({currentUser}){
  var _users = useState([
    {id:1,name:"ผู้ดูแลระบบ",email:"admin@up.ac.th",role:"admin",dept:"แผนกเทคโนโลยีสารสนเทศ (IT)",status:"active"},
    {id:2,name:"user",email:"user@up.ac.th",role:"user",dept:"แผนกผู้ป่วยนอก (OPD)",status:"active"},
    {id:3,name:"นพ.สมชาย ใจดี",email:"somchai@up.ac.th",role:"user",dept:"แผนกฉุกเฉิน (ER)",status:"active"},
    {id:4,name:"พญ.สมหญิง รักษาดี",email:"somying@up.ac.th",role:"user",dept:"แผนกผู้ป่วยใน (IPD)",status:"active"},
    {id:5,name:"ภก.กฤษณกวินทร์ ทำดี",email:"krit@up.ac.th",role:"user",dept:"แผนกเภสัชกรรม",status:"inactive"},
  ]);
  var users = _users[0]; var setUsers = _users[1];
  var _show = useState(false); var showAdd = _show[0]; var setShowAdd = _show[1];
  var _nf = useState({name:"",email:"",role:"user",dept:""}); var nf = _nf[0]; var setNf = _nf[1];

  function setF(k,v){setNf(function(p){var n=Object.assign({},p);n[k]=v;return n;});}

  function addUser(){
    if(!nf.name||!nf.email){alert("กรุณากรอกชื่อและอีเมล");return;}
    setUsers(function(p){return p.concat([{id:Date.now(),name:nf.name,email:nf.email,role:nf.role,dept:nf.dept,status:"active"}]);});
    setNf({name:"",email:"",role:"user",dept:""});
    setShowAdd(false);
  }

  function toggleStatus(id){
    setUsers(function(p){return p.map(function(u){
      if(u.id===id)return Object.assign({},u,{status:u.status==="active"?"inactive":"active"});
      return u;
    });});
  }

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}},
      React.createElement("h3",{style:{fontSize:18,fontWeight:700}},"👥 จัดการผู้ใช้งาน"),
      React.createElement(Btn,{variant:"primary",onClick:function(){setShowAdd(!showAdd);}},"➕ เพิ่มผู้ใช้")
    ),
    showAdd && React.createElement(Card,{title:"เพิ่มผู้ใช้ใหม่",icon:"user"},
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}},
        React.createElement(Inp,{label:"ชื่อ-สกุล",required:true,value:nf.name,onChange:function(v){setF("name",v);},placeholder:"ชื่อ-สกุล"}),
        React.createElement(Inp,{label:"อีเมล",required:true,value:nf.email,onChange:function(v){setF("email",v);},placeholder:"email@up.ac.th"}),
        React.createElement("div",{style:{marginBottom:14}},
          React.createElement("label",{style:{display:"block",fontSize:13,fontWeight:600,marginBottom:5}},"บทบาท"),
          React.createElement("select",{value:nf.role,onChange:function(e){setF("role",e.target.value);},style:{width:"100%",padding:"9px 12px",border:"1.5px solid #dce1e8",borderRadius:6,fontSize:13,fontFamily:"inherit"}},
            React.createElement("option",{value:"user"},"ผู้ใช้งาน"),
            React.createElement("option",{value:"admin"},"ผู้ดูแลระบบ")
          )
        ),
        React.createElement(SearchSel,{label:"แผนก",options:DEPTS,value:nf.dept,onChange:function(v){setF("dept",v);}})
      ),
      React.createElement("div",{style:{display:"flex",gap:8}},
        React.createElement(Btn,{variant:"success",onClick:addUser},"💾 บันทึก"),
        React.createElement(Btn,{variant:"outline",onClick:function(){setShowAdd(false);}},"ยกเลิก")
      )
    ),
    React.createElement("div",{style:{background:"#fff",borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",overflow:"hidden"}},
      React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:13}},
        React.createElement("thead",null,
          React.createElement("tr",{style:{background:"#f8fafc"}},
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"ชื่อ"),
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"อีเมล"),
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"บทบาท"),
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"left",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"แผนก"),
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"สถานะ"),
            React.createElement("th",{style:{padding:"10px 14px",textAlign:"center",fontWeight:700,borderBottom:"2px solid #dce1e8",fontSize:12}},"จัดการ")
          )
        ),
        React.createElement("tbody",null,
          users.map(function(u){
            return React.createElement("tr",{key:u.id,style:{borderBottom:"1px solid #f1f5f9"}},
              React.createElement("td",{style:{padding:"10px 14px",fontWeight:600}},u.name),
              React.createElement("td",{style:{padding:"10px 14px"}},u.email),
              React.createElement("td",{style:{padding:"10px 14px"}},
                React.createElement(Badge,{color:u.role==="admin"?"#ef4444":"#6366f1"},u.role==="admin"?"ผู้ดูแลระบบ":"ผู้ใช้งาน")
              ),
              React.createElement("td",{style:{padding:"10px 14px",fontSize:12}},u.dept||"-"),
              React.createElement("td",{style:{padding:"10px 14px",textAlign:"center"}},
                React.createElement(Badge,{color:u.status==="active"?"#10b981":"#94a3b8"},u.status==="active"?"ใช้งาน":"ระงับ")
              ),
              React.createElement("td",{style:{padding:"10px 14px",textAlign:"center"}},
                React.createElement(Btn,{variant:u.status==="active"?"outline":"success",size:"sm",onClick:function(){toggleStatus(u.id);}},u.status==="active"?"ระงับ":"เปิดใช้")
              )
            );
          })
        )
      )
    )
  );
}

/* ========== Loading Spinner ========== */

function LoadingSpinner(){
  return React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f0f3f7"}},
    React.createElement("div",{style:{textAlign:"center"}},
      React.createElement("div",{style:{fontSize:48,marginBottom:16,animation:"spin 1s linear infinite"}},"⏳"),
      React.createElement("div",{style:{fontSize:16,color:"#7f8c8d",fontWeight:600}},"กำลังโหลดข้อมูล..."),
      React.createElement("style",null,"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}")
    )
  );
}

/* ========== Main App ========== */

export default function App(){
  var authHook = useAuth();
  var user = authHook.user;
  var authLoading = authHook.loading;
  var complaintsHook = useComplaints();
  var complaints = complaintsHook.complaints;
  var dataLoading = complaintsHook.loading;

  var _page = useState("dash"); var page = _page[0]; var setPage = _page[1];
  var _sel = useState(null); var selComplaint = _sel[0]; var setSelComplaint = _sel[1];

  if(authLoading){
    return React.createElement(LoadingSpinner,null);
  }

  if(!user){
    return React.createElement(LoginPage,{authHook:authHook});
  }

  function handleLogout(){
    authHook.logout();
  }

  function handleNewSave(form){
    return complaintsHook.addComplaint(form).then(function(){
      setPage("reg");
    });
  }

  function handleUpdate(docId,data){
    return complaintsHook.updateComplaint(docId,data);
  }

  function handleSelect(c){
    setSelComplaint(c);
    setPage("detail");
  }

  function handleBackFromDetail(){
    setSelComplaint(null);
    setPage("reg");
  }

  var pageNames = {
    dash:"แดชบอร์ด",
    new:"บันทึกเรื่องร้องเรียน",
    reg:"ทะเบียนเรื่องร้องเรียน",
    detail:"รายละเอียดเรื่องร้องเรียน",
    guide:"แนวทางปฏิบัติ",
    line:"ตั้งค่า LINE Notify",
    users:"จัดการผู้ใช้"
  };

  function renderContent(){
    if(dataLoading && page==="dash"){
      return React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"center",height:400}},
        React.createElement("div",{style:{textAlign:"center"}},
          React.createElement("div",{style:{fontSize:48,marginBottom:16}},"⏳"),
          React.createElement("div",{style:{fontSize:14,color:"#7f8c8d"}},"กำลังโหลดข้อมูลจาก Firestore...")
        )
      );
    }

    switch(page){
      case "dash":
        return React.createElement(Dash,{complaints:complaints});
      case "new":
        return React.createElement(NewForm,{onSave:handleNewSave,onCancel:function(){setPage("dash");}});
      case "reg":
        return React.createElement(Reg,{complaints:complaints,onSelect:handleSelect});
      case "detail":
        if(!selComplaint) return React.createElement(Reg,{complaints:complaints,onSelect:handleSelect});
        return React.createElement(Detail,{complaint:selComplaint,onBack:handleBackFromDetail,onUpdate:handleUpdate});
      case "guide":
        return React.createElement(Guide,null);
      case "line":
        return React.createElement(LinePage,null);
      case "users":
        return React.createElement(UsersPage,{currentUser:user});
      default:
        return React.createElement(Dash,{complaints:complaints});
    }
  }

  return React.createElement("div",{style:{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}},
    React.createElement(Sidebar,{page:page,setPage:setPage,user:user,onLogout:handleLogout,complaints:complaints}),
    React.createElement("div",{style:{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}},
      React.createElement("div",{style:{background:"#fff",borderBottom:"1px solid #dce1e8",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}},
        React.createElement("h2",{style:{fontSize:18,fontWeight:700,color:"#0e2f44"}},pageNames[page]||"แดชบอร์ด"),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:12}},
          React.createElement("span",{style:{fontSize:12,color:"#7f8c8d"}},new Date().toLocaleDateString("th-TH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})),
          React.createElement("div",{style:{width:32,height:32,borderRadius:16,background:"#1a5276",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}},user.name?user.name.charAt(0):"U")
        )
      ),
      React.createElement("div",{style:{flex:1,padding:"20px 24px",overflowY:"auto",background:"#f0f3f7"}},
        renderContent()
      )
    )
  );
}
