(function () {
  const { MODAL, MODAL_MODE, NEW_TAB, COPY_KEY, DEPLOYABLE_KIND, EMAIL_KIND_FILTER, EMAIL_FIELD, ICON, EMAIL_PANEL, MAILTO_WARN_LENGTH } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    fmtDeployItem(i){
      let s=i.name||'';
      const port=(i.port==null?'':String(i.port)).trim();
      if(port) s+=':'+port;
      const ins=(i.instructions||[]).map(t=>(t||'').trim()).filter(Boolean);
      if(ins.length) s+=', '+ins.join(', ');
      return s;
    },
    buildDeployEmail(o){
      const envCode=o.envCode||'';
      const saludo=(o.hour<12)?'Buenos días,':'Buenas tardes,';
      const subject=('Despliegue ambiente '+envCode+' '+(o.projectNames||[]).join(', ')).trim();
      const folder=(o.deployFolder||'').trim()||'{deploy_folder}';
      const lines=[saludo,'',
        'Se hace la solicitud de cargar a ambiente '+envCode+' los siguientes aplicativos ubicados en la carpeta '+folder+' de los servidores:',''];
      const srvs=(o.servers||[]).slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      const items=o.items||[];
      srvs.forEach(sv=>{
        const mine=items.filter(i=>i.serverId===sv.id);
        if(!mine.length) return;
        lines.push(sv.code+': '+sv.ip);
        mine.forEach(i=>lines.push(this.fmtDeployItem(i)));
        lines.push('');
      });
      const huerfanos=items.filter(i=>!srvs.some(sv=>sv.id===i.serverId));
      if(huerfanos.length){
        lines.push('Servidor sin asignar:');
        huerfanos.forEach(i=>lines.push(this.fmtDeployItem(i)));
        lines.push('');
      }
      const nota=(o.nota||'').trim();
      if(nota){ lines.push(nota); lines.push(''); }
      lines.push('Quedo atento.');
      return {subject, body:lines.join('\r\n')};
    },
    openCorreoDespliegue(){
      if(!this.isDev()) return;
      const emp=this.empresa(); if(!emp) return;
      const ambs=emp.ambientes||[];
      if(!ambs.length){ this.setState({modal:{type:MODAL.notice,title:'Sin ambientes',mensaje:'Define ambientes para esta empresa antes de armar correos.'}, form:{}}); return; }
      if(!(emp.desplegables||[]).length){ this.setState({modal:{type:MODAL.notice,title:'Sin desplegables',mensaje:'Crea los desplegables de esta empresa antes de armar correos.'}, form:{}}); return; }
      const ctos=BOARD_EXT.emailableContacts(emp.contactos);
      this.openModal({type:MODAL.email,mode:MODAL_MODE.create,title:'Enviar correo despliegue',form:{
        envId: ambs[0].id,
        proyectoIds: [],
        itemIds: [],
        toIds: ctos.filter(k=>k.defaultField===EMAIL_FIELD.to).map(k=>k.id),
        ccIds: ctos.filter(k=>k.defaultField===EMAIL_FIELD.cc).map(k=>k.id),
        nota: '',
        cuerpoEditado: null,
      }});
      this.setState({correoOpen:{}});
    },
    toggleCorreoPanel(key){
      this.setState(s=>{ const cur=s.correoOpen||{}; return {correoOpen:{...cur, [key]:!cur[key]}}; });
    },
    setCorreoAmbiente(id){ this.setState(s=>({form:{...s.form, envId:id, cuerpoEditado:null}})); },
    setCorreoNota(e){ const v=e.target.value; this.setState(s=>({form:{...s.form, nota:v, cuerpoEditado:null}})); },
    _correoDesplegablesDe(pid){
      const emp=this.empresa()||{};
      const p=(emp.proyectos||[]).find(x=>x.id===pid)||{};
      const ids=p.desplegableIds||[];
      return (emp.desplegables||[]).filter(d=>ids.includes(d.id));
    },
    _correoCubiertosPorOtros(proyectoIds, exceptPid){
      const cubiertos=new Set();
      (proyectoIds||[]).forEach(otroPid=>{
        if(otroPid===exceptPid) return;
        this._correoDesplegablesDe(otroPid).forEach(d=>cubiertos.add(d.id));
      });
      return cubiertos;
    },
    dropItemsNotCoveredByOtherProjects(items, ids, proyectoIds, exceptPid){
      const cubiertos=this._correoCubiertosPorOtros(proyectoIds, exceptPid);
      ids.forEach(id=>{ if(!cubiertos.has(id)) items.delete(id); });
    },
    deployableMatchesKind(d, kind){ return kind===EMAIL_KIND_FILTER.both ? true : kind===EMAIL_KIND_FILTER.gateway ? d.kind===DEPLOYABLE_KIND.gateway : d.kind!==DEPLOYABLE_KIND.gateway; },
    toggleCorreoProyecto(pid){
      this.setState(s=>{
        const proys=(s.form.proyectoIds||[]).slice();
        const items=new Set(s.form.itemIds||[]);
        const mios=this._correoDesplegablesDe(pid).map(d=>d.id);
        const i=proys.indexOf(pid);
        if(i>=0){
          proys.splice(i,1);
          this.dropItemsNotCoveredByOtherProjects(items, mios, proys);
          return {form:{...s.form, proyectoIds:proys, itemIds:[...items], cuerpoEditado:null}};
        }
        proys.push(pid);
        mios.forEach(id=>items.add(id));
        return {form:{...s.form, proyectoIds:proys, itemIds:[...items], cuerpoEditado:null}};
      });
    },
    setCorreoProyectoKind(pid, kind){
      this.setState(s=>{
        const proys=s.form.proyectoIds||[];
        const items=new Set(s.form.itemIds||[]);
        const mios=this._correoDesplegablesDe(pid);
        const miosIds=mios.map(d=>d.id);
        const quiero=mios.filter(d=>this.deployableMatchesKind(d, kind)).map(d=>d.id);
        this.dropItemsNotCoveredByOtherProjects(items, miosIds, proys, pid);
        quiero.forEach(id=>items.add(id));
        return {form:{...s.form, itemIds:[...items], cuerpoEditado:null}};
      });
    },
    toggleCorreoItem(id){
      this.setState(s=>{
        const items=(s.form.itemIds||[]).slice();
        const i=items.indexOf(id);
        if(i>=0) items.splice(i,1); else items.push(id);
        return {form:{...s.form, itemIds:items, cuerpoEditado:null}};
      });
    },
    toggleExclusiveToOrCcRecipient(id, field){
      this.setState(s=>{
        const key = field===EMAIL_FIELD.to ? 'toIds' : 'ccIds';
        const otro = field===EMAIL_FIELD.to ? 'ccIds' : 'toIds';
        const cur=(s.form[key]||[]).slice();
        const i=cur.indexOf(id);
        if(i>=0) cur.splice(i,1); else cur.push(id);
        const otros=(s.form[otro]||[]).filter(x=>x!==id || i>=0);
        return {form:{...s.form, [key]:cur, [otro]:otros}};
      });
    },
    correoPayload(){
      const emp=this.empresa()||{}, f=this.state.form||{};
      const amb=(emp.ambientes||[]).find(a=>a.id===f.envId)||{};
      const deps=emp.desplegables||[];
      const insById={}; (emp.instrucciones||[]).forEach(i=>{ insById[i.id]=i.text; });
      const sel=f.itemIds||[];
      const items=deps.filter(d=>sel.includes(d.id))
        .slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))
        .map(d=>({ name:d.name, port:d.port, serverId:d.serverId,
                   instructions:(d.instruccionIds||[]).map(i=>insById[i]).filter(Boolean) }));
      const nombres=(emp.proyectos||[]).filter(p=>(f.proyectoIds||[]).includes(p.id)).map(p=>p.nombre);
      const built=this.buildDeployEmail({
        envCode: amb.code||'', deployFolder: amb.deployFolder||'',
        projectNames: nombres, servers: emp.servidores||[], items,
        nota: f.nota||'', hour: new Date().getHours(),
      });
      const byId={}; BOARD_EXT.emailableContacts(emp.contactos).forEach(k=>{ byId[k.id]=k; });
      const mails=(ids)=>(ids||[]).map(id=>(byId[id]||{}).email).filter(Boolean);
      const cuerpo = (f.cuerpoEditado==null) ? built.body : f.cuerpoEditado;
      return { subject:built.subject, body:cuerpo, to:mails(f.toIds), cc:mails(f.ccIds), itemsCount:items.length };
    },
    correoMailtoUrl(p){
      const q=[];
      if(p.cc.length) q.push('cc='+p.cc.join(','));
      q.push('subject='+encodeURIComponent(p.subject));
      q.push('body='+encodeURIComponent(p.body));
      return 'mailto:'+p.to.join(',')+'?'+q.join('&');
    },
    setCorreoCuerpo(e){ const v=e.target.value; this.setState(s=>({form:{...s.form, cuerpoEditado:v}})); },
    abrirCorreo(){
      const p=this.correoPayload();
      if(!p.to.length || !p.itemsCount) return;
      this.openMailtoInNewTab(this.correoMailtoUrl(p));
    },
    openMailtoInNewTab(url){
      const a=document.createElement('a');
      a.href=url; a.target=NEW_TAB.target; a.rel=NEW_TAB.rel;
      document.body.appendChild(a); a.click(); a.remove();
    },
    copiarCorreoCuerpo(){ this.copyToClipboard(this.correoPayload().body, COPY_KEY.emailBody); },
    emailVals(ctx){
      const { s, emp } = ctx;
      const R={};
      const md=s.modal;
      if(md.type===MODAL.email){
        const f=s.form||{};
        const ambs=(emp&&emp.ambientes)||[];
        const deps=(emp&&emp.desplegables)||[];
        const proys=(emp&&emp.proyectos)||[];
        const ctos=BOARD_EXT.emailableContacts(emp&&emp.contactos);
        const srvById={}; ((emp&&emp.servidores)||[]).forEach(x=>{ srvById[x.id]=x; });
        const sel=f.itemIds||[];
        const ambSel=ambs.find(a=>a.id===f.envId);
        const box=(on)=>({ boxBorder: on?'var(--gp-cyan)':'var(--gp-line-25)', boxBg: on?'var(--gp-cyan)':'transparent',
                           iconHref: on?ICON.check:ICON.x, color: on?'var(--gp-text)':'var(--gp-muted)',
                           bg: on?'var(--gp-cyan-10)':'var(--gp-field)', border: on?'var(--gp-cyan-45)':'var(--gp-line-20)' });
        const itemRow=(d)=>{ const srv=srvById[d.serverId];
          return Object.assign({ titulo: d.name + (d.port?(':'+d.port):''), servidor: srv?srv.code:'sin servidor',
                                 toggle:()=>this.toggleCorreoItem(d.id) }, box(sel.includes(d.id))); };

        R.correoAmbientes=ambs.map(a=>{ const on=a.id===f.envId;
          return { code:a.code, pick:()=>this.setCorreoAmbiente(a.id),
                   bg: on?'var(--gp-cyan-14)':'var(--gp-field)', border: on?'var(--gp-cyan)':'var(--gp-line-20)',
                   color: on?'var(--gp-cyan)':'var(--gp-muted)' }; });
        R.correoCarpetaFalta = !!(ambSel && !ambSel.deployFolder);

        const proySel=f.proyectoIds||[];
        R.correoProyectos=proys.map(p=>{
          const on=proySel.includes(p.id);
          const mios=deps.filter(d=>(p.desplegableIds||[]).includes(d.id));
          return Object.assign({ nombre:p.nombre, on, sinComponentes: on && !mios.length,
                                 toggle:()=>this.toggleCorreoProyecto(p.id),
                                 pickApi:()=>this.setCorreoProyectoKind(p.id,EMAIL_KIND_FILTER.api),
                                 pickGateway:()=>this.setCorreoProyectoKind(p.id,EMAIL_KIND_FILTER.gateway),
                                 pickAmbos:()=>this.setCorreoProyectoKind(p.id,EMAIL_KIND_FILTER.both),
                                 items: mios.map(itemRow) }, box(on));
        });

        const enAlgunProyecto=new Set();
        proys.forEach(p=>(p.desplegableIds||[]).forEach(id=>enAlgunProyecto.add(id)));
        const otros=deps.filter(d=>!enAlgunProyecto.has(d.id));
        R.correoOtrosEmpty=!otros.length;
        R.correoOtrosHay=!!otros.length;
        R.correoOtros=otros.map(d=>Object.assign(itemRow(d), {rowBg: sel.includes(d.id)?'var(--gp-cyan-10)':'transparent'}));

        const abiertos=s.correoOpen||{};
        const chevron=(on)=> on?'rotate(-90deg)':'rotate(90deg)';
        const otrosSel=otros.filter(d=>sel.includes(d.id));
        R.correoOtrosOpen=!!abiertos.otros;
        R.correoOtrosChevron=chevron(!!abiertos.otros);
        R.toggleCorreoOtros=()=>this.toggleCorreoPanel(EMAIL_PANEL.others);
        R.correoOtrosConteo=otrosSel.length+'/'+otros.length;
        R.correoOtrosResumen= otrosSel.length ? otrosSel.map(d=>d.name+(d.port?(':'+d.port):'')).join(', ') : 'Ninguno seleccionado';
        R.correoOtrosResumenColor= otrosSel.length?'var(--gp-text-2)':'var(--gp-muted-2)';
        R.correoOtrosBorder= otrosSel.length?'var(--gp-cyan-45)':'var(--gp-line-22)';

        R.correoContactosEmpty=!ctos.length;
        R.correoContactosHay=!!ctos.length;
        const ctoRow=(k,field)=>{
          const on=(f[field===EMAIL_FIELD.to?'toIds':'ccIds']||[]).includes(k.id);
          return Object.assign({ name:k.name, email:k.email, toggle:()=>this.toggleExclusiveToOrCcRecipient(k.id,field),
                                 rowBg: on?(field===EMAIL_FIELD.to?'var(--gp-cyan-10)':'var(--gp-violet-10)'):'transparent' },
                               box(on));
        };
        R.correoContactosTo=ctos.map(k=>ctoRow(k,EMAIL_FIELD.to));
        R.correoContactosCc=ctos.map(k=>ctoRow(k,EMAIL_FIELD.cc));
        const nombresDe=(ids)=>ctos.filter(k=>(ids||[]).includes(k.id)).map(k=>k.name);
        const nomTo=nombresDe(f.toIds), nomCc=nombresDe(f.ccIds);
        R.correoToOpen=!!abiertos.to; R.correoCcOpen=!!abiertos.cc;
        R.correoToChevron=chevron(!!abiertos.to); R.correoCcChevron=chevron(!!abiertos.cc);
        R.toggleCorreoTo=()=>this.toggleCorreoPanel(EMAIL_PANEL.to);
        R.toggleCorreoCc=()=>this.toggleCorreoPanel(EMAIL_PANEL.cc);
        R.correoToResumen= nomTo.length ? nomTo.join(', ') : 'Sin destinatarios';
        R.correoToResumenColor= nomTo.length?'var(--gp-text-2)':'var(--gp-amber)';
        R.correoToBorder= nomTo.length?'var(--gp-cyan-45)':'var(--gp-amber-45)';
        R.correoCcResumen= nomCc.length ? nomCc.join(', ') : 'Nadie en copia';
        R.correoCcResumenColor= nomCc.length?'var(--gp-text-2)':'var(--gp-muted-2)';
        R.correoCcBorder= nomCc.length?'var(--gp-violet-45)':'var(--gp-line-22)';
        R.setCorreoNota=(e)=>this.setCorreoNota(e);

        const p=this.correoPayload();
        const url=this.correoMailtoUrl(p);
        const falta=[];
        if(!f.envId) falta.push('elige un ambiente');
        if(!p.itemsCount) falta.push('marca al menos un desplegable');
        if(!p.to.length) falta.push('agrega al menos un destinatario en Para');
        const puede=!falta.length;
        const copiado=s.copiedKey===COPY_KEY.emailBody;
        R.correoAsunto=p.subject;
        R.correoCuerpo=p.body;
        R.correoChars=url.length+' / 2048 caracteres';
        R.correoCharsColor= url.length>MAILTO_WARN_LENGTH ? 'var(--gp-amber)' : 'var(--gp-muted-2)';
        R.correoLargo= url.length>MAILTO_WARN_LENGTH;
        R.correoBloqueo= falta.length ? ('Para poder abrir el correo: '+falta.join(', ')+'.') : '';
        R.correoBloqueoShow=!!falta.length;
        R.correoNoPuede=!puede;
        R.correoBtnBg= puede ? 'linear-gradient(135deg,var(--gp-indigo),var(--gp-sky))' : 'var(--gp-line-14)';
        R.correoBtnColor= puede ? 'var(--gp-white)' : 'var(--gp-muted-2)';
        R.correoBtnCursor= puede ? 'pointer' : 'not-allowed';
        R.abrirCorreo=()=>this.abrirCorreo();
        R.copiarCorreoCuerpo=()=>this.copiarCorreoCuerpo();
        R.correoCopyLabel= copiado ? 'Copiado' : 'Copiar cuerpo';
        R.correoCopyIcon= copiado ? ICON.check : ICON.copy;
        R.correoCopyColor= copiado ? 'var(--gp-green)' : 'var(--gp-text-2)';
        R.setCorreoCuerpo=(e)=>this.setCorreoCuerpo(e);
      }
      return R;
    },
  });
})();
