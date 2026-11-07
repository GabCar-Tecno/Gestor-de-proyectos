(function () {
  const { SAVE_STATUS, MODAL, MODAL_MODE, TABLE, DB_DEFAULT, DEPLOYABLE_KIND, EMAIL_FIELD } = window.APP_CONSTANTS;

  const empresaLogos={ coltanques:'./assets/logos/coltanques.svg', tecno:'./assets/logos/tecno.svg', d1:'./assets/logos/d1.png', 'tiendas d1':'./assets/logos/d1.png' };
  const logoDe=e=>empresaLogos[(e.nombre||'').trim().toLowerCase()]||'';

  window.ROOT_MIXINS.push({
    addEmpresa(){ if(!this.isDev()) return; this.openModal({type:MODAL.company,mode:MODAL_MODE.create,title:'Nueva empresa',form:{nombre:''}}); },
    addProyecto(){ if(!this.isDev()) return; this.openModal({type:MODAL.project,mode:MODAL_MODE.create,title:'Nuevo proyecto',form:{nombre:'',descripcion:''}}); },
    setEnvRow(i,k,v){ this.setState(s=>{ const rows=s.form.envRows.map((r,j)=>j===i?{...r,[k]:v}:r); return {form:{...s.form,envRows:rows}}; }); },
    setGithubLinkRow(i,k,v){ this.setState(s=>{ const rows=s.form.links.map((r,j)=>j===i?{...r,[k]:v}:r); return {form:{...s.form,links:rows}}; }); },
    addGithubLinkRow(){ this.setState(s=>({form:{...s.form,links:[...s.form.links,{label:'',url:''}]}})); },
    removeGithubLinkRow(i){ this.setState(s=>({form:{...s.form,links:s.form.links.filter((r,j)=>j!==i)}})); },
    editCredenciales(){ if(!this.isDev()) return; const p=this.proyecto(); const rows=(p.recursos.credenciales||[]).map(c=>({environmentId:c.environmentId||'',label:c.label||'',username:c.username||'',secret:c.secret||'',url:c.url||'',notes:c.notes||''})); this.openModal({type:MODAL.credentials,mode:MODAL_MODE.edit,title:'Accesos del proyecto',form:{credRows:rows.length?rows:[{environmentId:'',label:'',username:'',secret:'',url:'',notes:''}]}}); this.setState({modalShowPass:{}}); },
    setCredRow(i,k,v){ this.setState(s=>{ const rows=s.form.credRows.map((r,j)=>j===i?{...r,[k]:v}:r); return {form:{...s.form,credRows:rows}}; }); },
    addCredRow(){ this.setState(s=>({form:{...s.form,credRows:[...s.form.credRows,{environmentId:'',label:'',username:'',secret:'',url:'',notes:''}]}})); },
    removeCredRow(i){ this.setState(s=>({form:{...s.form,credRows:s.form.credRows.filter((r,j)=>j!==i)}})); },
    toggleCredShown(id){ this.setState(s=>({credShown:{...s.credShown,[id]:!s.credShown[id]}})); },
    addAmbiente(){ if(!this.isDev()) return; this.openModal({type:MODAL.environment,mode:MODAL_MODE.create,title:'Nuevo ambiente',form:{code:'',label:'',deployFolder:'',stage:''}}); },
    editAmbiente(id){ if(!this.isDev()) return; const a=((this.empresa()||{}).ambientes||[]).find(x=>x.id===id); if(!a) return; this.openModal({type:MODAL.environment,mode:MODAL_MODE.edit,id,title:'Editar ambiente',form:{code:a.code||'',label:a.label||'',deployFolder:a.deployFolder||'',stage:a.stage||''}}); },
    async delAmbiente(id){
      if(!this.isDev()||this._busy) return;
      const emp=this.empresa(); if(!emp) return;
      const inUse=(emp.proyectos||[]).some(p=>
        (p.recursos.despliegues||[]).some(d=>d.environmentId===id && ((d.url||'').trim()||(d.version||'').trim())) ||
        (p.requerimientos||[]).some(r=>(r.despliegues||[]).some(d=>d.environmentId===id && ((d.url||'').trim()||(d.version||'').trim())))
      );
      if(inUse){ this.setState({modal:{type:MODAL.notice,title:'Ambiente en uso',mensaje:'Este ambiente tiene despliegues con datos (URL o versión). Bórralos o muévelos antes de eliminar el ambiente.'}, form:{}}); return; }
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      const sb=this._sb;
      try{
        let { error } = await sb.from(TABLE.projectDeployments).delete().eq('environment_id', id);
        if(error) throw error;
        ({ error } = await sb.from(TABLE.requirementDeployments).delete().eq('environment_id', id));
        if(error) throw error;
        ({ error } = await sb.from(TABLE.environments).delete().eq('id', id));
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error,modal:{type:MODAL.notice,title:'No se pudo eliminar el requerimiento',mensaje:e.message||'Verifica el acceso a sus documentos.'},form:{}}); console.error(e); }
      finally{ this._busy=false; }
    },
    addServidor(){ if(!this.isDev()) return; this.openModal({type:MODAL.server,mode:MODAL_MODE.create,title:'Nuevo servidor',form:{code:'',ip:''}}); },
    editServidor(id){ if(!this.isDev()) return; const s=((this.empresa()||{}).servidores||[]).find(x=>x.id===id); if(!s) return; this.openModal({type:MODAL.server,mode:MODAL_MODE.edit,id,title:'Editar servidor',form:{code:s.code||'',ip:s.ip||''}}); },
    async delServidor(id){
      if(!this.isDev()||this._busy) return;
      const emp=this.empresa(); if(!emp) return;
      const usados=(emp.desplegables||[]).filter(d=>d.serverId===id);
      if(usados.length){ this.setState({modal:{type:MODAL.notice,title:'Servidor en uso',mensaje:'Hay '+usados.length+' desplegable(s) en este servidor. Muévelos a otro servidor antes de eliminarlo.'}, form:{}}); return; }
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const { error } = await this._sb.from(TABLE.companyServers).delete().eq('id', id);
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    addInstruccion(){ if(!this.isDev()) return; this.openModal({type:MODAL.instruction,mode:MODAL_MODE.create,title:'Nueva instrucción',form:{text:''}}); },
    editInstruccion(id){ if(!this.isDev()) return; const i=((this.empresa()||{}).instrucciones||[]).find(x=>x.id===id); if(!i) return; this.openModal({type:MODAL.instruction,mode:MODAL_MODE.edit,id,title:'Editar instrucción',form:{text:i.text||''}}); },
    async delInstruccion(id){
      if(!this.isDev()||this._busy) return;
      const emp=this.empresa(); if(!emp) return;
      const usos=(emp.desplegables||[]).filter(d=>(d.instruccionIds||[]).includes(id)).length;
      if(usos){ this.setState({modal:{type:MODAL.notice,title:'Instrucción en uso',mensaje:'Esta instrucción está aplicada a '+usos+' desplegable(s). Se van a borrar esos enlaces. Quítala de los desplegables si no quieres perderlos.'}, form:{}}); return; }
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        let { error } = await this._sb.from(TABLE.deployableInstructions).delete().eq('instruction_id', id);
        if(error) throw error;
        ({ error } = await this._sb.from(TABLE.deploymentInstructions).delete().eq('id', id));
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    addContacto(){ if(!this.isDev()) return; this.openModal({type:MODAL.contact,mode:MODAL_MODE.create,title:'Nuevo contacto',form:{name:'',email:'',role:'',defaultField:''}}); },
    editContacto(id){ if(!this.isDev()) return; const k=((this.empresa()||{}).contactos||[]).find(x=>x.id===id); if(!k) return; this.openModal({type:MODAL.contact,mode:MODAL_MODE.edit,id,title:'Editar contacto',form:{name:k.name||'',email:k.email||'',role:k.role||'',defaultField:k.defaultField||''}}); },
    async delContacto(id){
      if(!this.isDev()||this._busy) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        const { error } = await this._sb.from(TABLE.companyContacts).delete().eq('id', id);
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    addDesplegable(){
      if(!this.isDev()) return;
      const srvs=(this.empresa()||{}).servidores||[];
      if(!srvs.length){ this.setState({modal:{type:MODAL.notice,title:'Sin servidores',mensaje:'Crea al menos un servidor antes de agregar desplegables.'}, form:{}}); return; }
      this.openModal({type:MODAL.deployable,mode:MODAL_MODE.create,title:'Nuevo desplegable',form:{name:'',kind:DB_DEFAULT.deployableKind,serverId:srvs[0].id,port:'',instruccionIds:[]}});
    },
    editDesplegable(id){
      if(!this.isDev()) return;
      const d=((this.empresa()||{}).desplegables||[]).find(x=>x.id===id); if(!d) return;
      this.openModal({type:MODAL.deployable,mode:MODAL_MODE.edit,id,title:'Editar desplegable',form:{name:d.name||'',kind:d.kind||DB_DEFAULT.deployableKind,serverId:d.serverId||'',port:d.port||'',instruccionIds:(d.instruccionIds||[]).slice()}});
    },
    toggleDesplegableInstruccion(insId){
      this.setState(s=>{
        const cur=(s.form.instruccionIds||[]).slice();
        const i=cur.indexOf(insId);
        if(i>=0) cur.splice(i,1); else cur.push(insId);
        return {form:{...s.form, instruccionIds:cur}};
      });
    },
    async delDesplegable(id){
      if(!this.isDev()||this._busy) return;
      this._busy=true;
      this.setState({saveStatus:SAVE_STATUS.saving});
      try{
        let { error } = await this._sb.from(TABLE.deployableInstructions).delete().eq('deployable_id', id);
        if(error) throw error;
        ({ error } = await this._sb.from(TABLE.projectDeployables).delete().eq('deployable_id', id));
        if(error) throw error;
        ({ error } = await this._sb.from(TABLE.deployables).delete().eq('id', id));
        if(error) throw error;
        this.setState({saveStatus:SAVE_STATUS.saved});
        await this.loadData();
      }catch(e){ this.setState({saveStatus:SAVE_STATUS.error}); console.error(e); }
      finally{ this._busy=false; }
    },
    openComponentesProy(){
      if(!this.isDev()) return;
      const p=this.proyecto(); if(!p) return;
      this.openModal({type:MODAL.components,mode:MODAL_MODE.edit,title:'Componentes desplegables',form:{desplegableIds:(p.desplegableIds||[]).slice()}});
    },
    toggleProyDesplegable(id){
      this.setState(s=>{
        const cur=(s.form.desplegableIds||[]).slice();
        const i=cur.indexOf(id);
        if(i>=0) cur.splice(i,1); else cur.push(id);
        return {form:{...s.form, desplegableIds:cur}};
      });
    },
    editGithubLinks(){ if(!this.isDev()) return; const p=this.proyecto(); const links=p.recursos.github.map(g=>({label:g.label,url:g.url})); this.openModal({type:MODAL.githubLinks,mode:MODAL_MODE.edit,title:'Repositorios de GitHub',form:{links:links.length?links:[{label:'',url:''}]}}); },
    openVerGithubLinks(){ const p=this.proyecto(); this.setState({modal:{type:MODAL.viewGithubLinks, title:'Repositorios de GitHub', links:p.recursos.github}, form:{}}); },
    openVerDespliegue(env,url,version,environmentId){
      this.setState({modal:{type:MODAL.viewDeployment, title:'Despliegue '+env, envName:env, environmentId:environmentId||null, url:url||'', version:version||''}, form:{}});
    },
    openRecurso(key,label,icon){ const p=this.proyecto(); this.openModal({type:MODAL.resource,mode:MODAL_MODE.edit,rkey:key,rlabel:label,ricon:icon,title:label,form:{url:(p.recursos[key]||{}).url||''}}); },
    editDesplieguesProy(){ if(!this.isDev()) return; const p=this.proyecto(); this._origEnvRows=p.recursos.despliegues.reduce((a,d)=>{a[d.environmentId]={url:d.url,version:d.version,updatedAt:d.updatedAt}; return a;},{}); this.openModal({type:MODAL.projectDeployments,mode:MODAL_MODE.edit,title:'Despliegues del proyecto',form:{envRows:p.recursos.despliegues.map(d=>({...d}))}}); },
    setDeploymentEnvironment(id){
      const project=this.proyecto();
      const row=((project&&project.recursos&&project.recursos.despliegues)||[]).find(d=>d.environmentId===id)||{};
      this.setState(s=>({form:{...s.form,env:id,url:row.url||'',version:row.version||''}}));
    },
    companiesVals(ctx){
      const { s } = ctx;
      const R={};
      R.empresasList=s.data.map(e=>({ id:e.id,nombre:e.nombre,mono:e.mono,color:e.color, logo:logoDe(e), proyectosLabel:`${e.proyectos.length} proyecto${e.proyectos.length===1?'':'s'}`, open:()=>this.openEmpresa(e.id) }));
      return R;
    },
    companyVals(ctx){
      const { isDev, emp } = ctx;
      const R={};
      if(!emp) return R;
      R.empresa={ nombre:emp.nombre, mono:emp.mono, color:emp.color, logo:logoDe(emp), proyectosLabel:`${emp.proyectos.length} proyecto${emp.proyectos.length===1?'':'s'}` };
      R.showAmbientes=isDev;
      R.ambientesEmpty=!(emp.ambientes||[]).length;
      R.ambientesList=(emp.ambientes||[]).map(a=>{ const sm=a.stage?this.estMeta(a.stage):null; return { id:a.id, code:a.code, label:a.label||a.code, stageLabel: sm?sm[0]:'Sin etapa', stageColor: sm?sm[1]:'var(--gp-muted-2)', stageBg: sm?sm[2]:'var(--gp-hover-bg)', carpetaTexto: a.deployFolder ? a.deployFolder : 'Sin carpeta de despliegue', edit:()=>this.editAmbiente(a.id), del:()=>this.delAmbiente(a.id) }; });
      R.addAmbiente=()=>this.addAmbiente();
      R.showParam=isDev;
      R.openCorreoDespliegue=()=>this.openCorreoDespliegue();
      const _srvs=(emp&&emp.servidores)||[];
      R.servidoresEmpty=!_srvs.length;
      R.servidoresList=_srvs.map(s=>({ code:s.code, ip:s.ip, edit:()=>this.editServidor(s.id), del:()=>this.delServidor(s.id) }));
      R.addServidor=()=>this.addServidor();
      const _inss=(emp&&emp.instrucciones)||[];
      R.instruccionesEmpty=!_inss.length;
      R.instruccionesList=_inss.map(i=>({ text:i.text, edit:()=>this.editInstruccion(i.id), del:()=>this.delInstruccion(i.id) }));
      R.addInstruccion=()=>this.addInstruccion();
      const _ctos=(emp&&emp.contactos)||[];
      R.contactosEmpty=!_ctos.length;
      R.contactosList=_ctos.map(k=>{
        const meta = k.defaultField===EMAIL_FIELD.to ? ['Para','var(--gp-cyan)','var(--gp-cyan-16)']
                   : k.defaultField===EMAIL_FIELD.cc ? ['CC','var(--gp-violet)','var(--gp-violet-16)']
                   : ['Manual','var(--gp-muted)','var(--gp-steel-14)'];
        return { name:k.name, email:k.email||'Sin correo', isPm:k.role===BOARD_EXT.CONTACT_ROLE.pm, badgeLabel:meta[0], badgeColor:meta[1], badgeBg:meta[2],
                 edit:()=>this.editContacto(k.id), del:()=>this.delContacto(k.id) };
      });
      R.addContacto=()=>this.addContacto();
      const _deps=(emp&&emp.desplegables)||[];
      const _srvById={}; _srvs.forEach(x=>{ _srvById[x.id]=x; });
      const _insById={}; _inss.forEach(x=>{ _insById[x.id]=x; });
      R.desplegablesEmpty=!_deps.length;
      R.desplegablesList=_deps.map(d=>{
        const srv=_srvById[d.serverId];
        const meta = d.kind===DEPLOYABLE_KIND.gateway ? ['Gateway','var(--gp-violet)','var(--gp-violet-16)']
                   : d.kind===DEPLOYABLE_KIND.app     ? ['App','var(--gp-amber)','var(--gp-amber-16)']
                   :                      ['API','var(--gp-cyan)','var(--gp-cyan-16)'];
        const insTxt=(d.instruccionIds||[]).map(i=>(_insById[i]||{}).text).filter(Boolean);
        const partes=[srv?(srv.code+': '+srv.ip):'Servidor sin asignar'];
        if(insTxt.length) partes.push(insTxt.join(', '));
        return { titulo: d.name + (d.port?(':'+d.port):''), detalle: partes.join(' · '),
                 kindLabel:meta[0], kindColor:meta[1], kindBg:meta[2],
                 edit:()=>this.editDesplegable(d.id), del:()=>this.delDesplegable(d.id) };
      });
      R.addDesplegable=()=>this.addDesplegable();
      return R;
    }
  });
})();
