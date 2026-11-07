(function () {
  const { MODAL, MODAL_MODE, NEW_TAB, COPY_KEY, DEPLOYABLE_KIND, EMAIL_KIND_FILTER, EMAIL_FIELD } = window.APP_CONSTANTS;

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
  });
})();
