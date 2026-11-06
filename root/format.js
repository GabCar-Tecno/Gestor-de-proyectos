(function () {
  const { LOCALE, ICON, ESTIMATION_DEFAULTS, LOCAL_DATE_SUFFIX, DELAY_MS, SHORT_DAY_MONTH, MS_PER_DAY } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    gid(p){ return p+'-'+(window.crypto&&crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2)); },
    iniciales(n){ return (this.parseOwners(n)[0]||n||'').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase(); },
    emailInitials(email){ if(!email) return '?'; const local=email.split('@')[0]; const parts=local.split(/[._-]/).filter(Boolean); if(parts.length>=2) return (parts[0][0]+parts[1][0]).toUpperCase(); return local.slice(0,2).toUpperCase(); },
    relDate(iso){
      if(!iso) return null;
      const d=new Date(iso), now=new Date();
      const days=Math.floor((now.setHours(0,0,0,0)-new Date(d).setHours(0,0,0,0))/MS_PER_DAY);
      if(days===0) return 'hoy';
      if(days===1) return 'ayer';
      if(days>1 && days<=7) return 'hace '+days+' días';
      return d.toLocaleDateString(LOCALE,SHORT_DAY_MONTH);
    },
    docIcon(t){ t=(t||'').toLowerCase(); if(t.includes('pdf')||t.includes('word')||t==='doc'||t==='docx')return ICON.fileText; if(t.includes('fig')||t.includes('imag'))return ICON.image; if(t.includes('diag'))return ICON.diagram; if(t.includes('cálc')||t.includes('xls'))return ICON.chart; return ICON.file; },
    hoursText(req){ return req.horas!==''&&req.horas!=null?String(req.horas):'—'; },
    groupRowsBy(rows,key){ const groups=new Map(); (rows||[]).forEach(row=>{ const group=groups.get(row[key]); if(group) group.push(row); else groups.set(row[key],[row]); }); return groups; },
    indexById(rows){ const index=new Map(); (rows||[]).forEach(row=>{ if(!index.has(row.id)) index.set(row.id,row); }); return index; },
    copyToClipboard(text,key){
      if(!text) return;
      const done=()=>{ this.setState({copiedKey:key}); clearTimeout(this._copyT); this._copyT=setTimeout(()=>this.setState({copiedKey:''}),DELAY_MS.copiedFeedback); };
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(done); }
      else{
        const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(e){}
        document.body.removeChild(ta); done();
      }
    },
    todayIso(){ const t=new Date(), pad=n=>String(n).padStart(2,'0'); return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()); },
    parseLocalDate(isoDate){ return new Date(isoDate+LOCAL_DATE_SUFFIX); },
    fmtNum(n,dec=4){ return n==null||!Number.isFinite(n) ? '—' : String(parseFloat(n.toFixed(dec))); },
    parseDecimalCommaOrDot(v){ const t=String(v??'').trim().replace(',','.'); if(t==='') return ''; return /^(\d+\.?\d*|\.\d+)$/.test(t)?Number(t):NaN; },
    nextVersionLabel(v){ const t=String(v||'').trim(); if(!t) return ESTIMATION_DEFAULTS.duplicateVersionLabel; const m=t.match(/^(.*?)(\d+)(\D*)$/); return m ? m[1]+(Number(m[2])+1)+m[3] : t+' 2'; },
    formatDayCount(x){
      if(x==null||!Number.isFinite(x)) return '—';
      const n=this.fmtNum(x,2);
      return n+(n==='1'?' día':' días');
    },
    formatSlashDate(iso){
      if(!iso) return '—';
      const d=this.parseLocalDate(iso);
      if(Number.isNaN(d.getTime())) return '—';
      return d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();
    },
    formatExportStamp(d){
      const months=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
      const raw=String(d.versionLabel||'').trim();
      const version=/^versi[oó]n\b/i.test(raw)?raw:('Versión '+(raw||'—'));
      if(!d.estimatedOn) return version;
      const day=this.parseLocalDate(d.estimatedOn);
      if(Number.isNaN(day.getTime())) return version;
      const dd=String(day.getDate()).padStart(2,'0');
      return version+' · '+dd+' '+months[day.getMonth()]+' '+day.getFullYear();
    }
  });
})();
