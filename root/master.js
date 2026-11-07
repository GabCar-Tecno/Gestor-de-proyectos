(function () {
  const { VIEW, LOCALE, MODAL, MODAL_MODE, TABLE, FILE_NAME, ID_PREFIX, REQ_STATUS, STATUS_LABEL_HINT, MS_PER_DAY, EXCEL } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    extendedDisplay(company,req){
      const byId={}; ((company&&company.contactos)||[]).forEach(c=>{ byId[c.id]=c; });
      const day=v=>v?this.parseLocalDate(v).toLocaleDateString(LOCALE):'—';
      const pm=req.pmContactId&&byId[req.pmContactId];
      const d={ pmEntrega:pm?pm.name:'—', fechaSolicitud:day(req.fechaSolicitud), fechaEntregaEstimacion:day(req.fechaEntregaEstimacion),
        fechaAprobacionEstimacion:day(req.fechaAprobacionEstimacion), fechaInicioDesarrollo:day(req.fechaInicioDesarrollo), fechaEntregaPruebas:day(req.fechaEntregaPruebas),
        responsablesTxt:(req.responsables||[]).join(', ')||'—', horasTxt:this.hoursText(req),
        facturadoTxt:BOARD_EXT.formatInvoiced(req.facturado,req.mesFacturado,LOCALE), facturadoColor:req.facturado?'var(--gp-success)':'var(--gp-muted-3)' };
      d.items=[['PM Entrega',d.pmEntrega],['Fecha de solicitud',d.fechaSolicitud],['Fecha entrega estimación',d.fechaEntregaEstimacion],['Fecha aprobación estimación',d.fechaAprobacionEstimacion],
        ['Fecha inicio desarrollo',d.fechaInicioDesarrollo],['Fecha real entrega a pruebas',d.fechaEntregaPruebas],['Facturado',d.facturadoTxt]].map(([label,value])=>({label,value}));
      return d;
    },
    maestroScrollParts(){
      const table=document.querySelector('.master-table--scroll'), track=document.querySelector('.master-scroll-top');
      const thumb=track&&track.querySelector('.master-scroll-thumb');
      return table&&track&&thumb ? {table,track,thumb} : null;
    },
    syncMaestroThumb(){
      const p=this.maestroScrollParts(); if(!p) return;
      const {table,track,thumb}=p, max=table.scrollWidth-table.clientWidth;
      track.style.display=max>0?'block':'none';
      const trackW=track.clientWidth;
      if(max<=0||!trackW) return;
      const thumbW=Math.max(40,trackW*table.clientWidth/table.scrollWidth);
      thumb.style.width=thumbW+'px';
      thumb.style.transform='translateX('+((trackW-thumbW)*table.scrollLeft/max)+'px)';
    },
    startMaestroThumbDrag(e){
      const p=this.maestroScrollParts(); if(!p) return;
      const {table,track,thumb}=p, max=table.scrollWidth-table.clientWidth; if(max<=0) return;
      e.preventDefault();
      const trackW=track.clientWidth, thumbW=thumb.offsetWidth, travel=Math.max(1,trackW-thumbW);
      if(e.target!==thumb){
        const x=e.clientX-track.getBoundingClientRect().left-thumbW/2;
        table.scrollLeft=Math.min(max,Math.max(0,x/travel*max));
      }
      const startX=e.clientX, startLeft=table.scrollLeft;
      track.classList.add('dragging');
      const move=ev=>{ table.scrollLeft=Math.min(max,Math.max(0,startLeft+(ev.clientX-startX)/travel*max)); };
      const up=()=>{ track.classList.remove('dragging'); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
    },
    reqFormCompany(m,f){ return m&&m.global ? (this.state.data||[]).find(c=>c.id===(f&&f.empresaId))||null : this.empresa()||null; },
    pmPickerView(company,form){
      const contacts=(company&&company.contactos)||[];
      const selected=contacts.find(c=>c.id===form.pmContactId)||null;
      const editing=form.pmQuery!==undefined, query=editing?form.pmQuery:'';
      const matches=editing?BOARD_EXT.filterPmContacts(contacts,query).slice(0,8):[];
      const canAdd=editing&&!!query.trim()&&!BOARD_EXT.findPmContactByName(contacts,query);
      return { value:editing?query:(selected?selected.name:''), open:editing&&(matches.length>0||canAdd),
        options:matches.map(c=>({label:c.name, pick:()=>this.pickPmContact(c.id)})),
        canAdd, addLabel:'Agregar «'+query.trim()+'» como PM', add:()=>this.createPmContact(company&&company.id,query),
        hasValue:!!selected||editing, clear:()=>this.pickPmContact(''),
        onInput:e=>this.setPmQuery(e.target.value), onFocus:()=>{ if(!editing) this.setPmQuery(''); },
        onKeyDown:e=>{ if(e.key==='Enter'){ e.preventDefault(); const exact=BOARD_EXT.findPmContactByName(contacts,query); if(exact) this.pickPmContact(exact.id); else if(canAdd) this.createPmContact(company&&company.id,query); } if(e.key==='Escape') this.setState(s=>({form:{...s.form,pmQuery:undefined}})); } };
    },
    monthPickerView(form){
      const now=new Date(), year=form.mesPickerYear||BOARD_EXT.yearOf(form.mesFacturado,now.getFullYear());
      const todayValue=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
      const set=patch=>this.setState(s=>({form:{...s.form,...patch}}));
      const monthText=form.mesFacturado?BOARD_EXT.formatMonth(form.mesFacturado,LOCALE):'';
      return { label:monthText?monthText.charAt(0).toUpperCase()+monthText.slice(1):'Selecciona el mes', hasValue:!!form.mesFacturado,
        labelColor:form.mesFacturado?'var(--gp-text)':'var(--gp-muted-2)', open:!!form.mesPickerOpen, year:String(year),
        toggle:()=>set({mesPickerOpen:!form.mesPickerOpen, mesPickerYear:year}),
        prev:()=>set({mesPickerYear:year-1}), next:()=>set({mesPickerYear:year+1}),
        months:BOARD_EXT.monthGrid(year,form.mesFacturado).map(m=>({ label:m.short, pick:()=>set({mesFacturado:m.value,mesPickerOpen:false}),
          bg:m.selected?'var(--gp-cyan)':'transparent', color:m.selected?'var(--gp-white)':'var(--gp-text)', weight:m.selected?700:500,
          border:m.value===todayValue&&!m.selected?'var(--gp-cyan-40)':'transparent' })) };
    },
    setPmQuery(q){ this.setState(s=>({form:{...s.form,pmQuery:q}})); },
    pickPmContact(id){ this.setState(s=>({form:{...s.form,pmContactId:id||'',pmQuery:undefined}})); },
    setFacturado(on){ this.setState(s=>({form:{...s.form,facturado:!!on,mesFacturado:on?s.form.mesFacturado||'':''}})); },
    async createPmContact(companyId,name){
      const clean=String(name||'').replace(/\s+/g,' ').trim(); if(!clean||!companyId||!this.isPM()) return;
      const company=(this.state.data||[]).find(c=>c.id===companyId); if(!company) return;
      const existing=BOARD_EXT.findPmContactByName(company.contactos,clean);
      if(existing){ this.pickPmContact(existing.id); return; }
      const maxOrder=(company.contactos||[]).reduce((mx,x)=>Math.max(mx,x.sortOrder||0),0);
      const id=this.gid(ID_PREFIX.contact);
      const { error } = await this._sb.from(TABLE.companyContacts).insert({ id, company_id:companyId, name:clean, email:null, role:BOARD_EXT.CONTACT_ROLE.pm, default_field:null, sort_order:maxOrder+1 });
      if(error){ this.setState({modalErr:'No se pudo crear el PM: '+error.message}); return; }
      await this.loadData();
      this.pickPmContact(id);
    },
    setMaestroSearch(e){ this.setState({maestroSearch:e.target.value}); },
    toggleMaestroProjectMenu(){ this.setState(s=>({maestroProjectMenuOpen:!s.maestroProjectMenuOpen,maestroStatusMenuOpen:false})); },
    toggleMaestroStatusMenu(){ this.setState(s=>({maestroStatusMenuOpen:!s.maestroStatusMenuOpen,maestroProjectMenuOpen:false})); },
    closeMaestroProjectMenu(){ this.setState({maestroProjectMenuOpen:false}); },
    closeMaestroStatusMenu(){ this.setState({maestroStatusMenuOpen:false}); },
    closeMaestroEstMenu(){ this.setState({maestroEstMenu:null}); },
    latestEstimacionOf(project,reqId){ return (project.estimaciones||[]).filter(e=>e.requirementId===reqId).reduce((best,e)=>!best||String(e.updatedAt||'')>String(best.updatedAt||'')?e:best,null); },
    toggleMaestroEstMenu(e,companyId,projectId,estId){
      e.stopPropagation();
      const open=this.state.maestroEstMenu;
      if(open&&open.estId===estId){ this.setState({maestroEstMenu:null}); return; }
      const rect=e.currentTarget.getBoundingClientRect(), below=rect.bottom<window.innerHeight/2;
      this.setState({maestroEstMenu:{companyId,projectId,estId,left:rect.left+'px',top:below?(rect.bottom+8)+'px':'auto',bottom:below?'auto':(window.innerHeight-rect.top+8)+'px'}});
    },
    maestroRowKey(e,open){ if(e.target!==e.currentTarget||(e.key!=='Enter'&&e.key!==' ')) return; e.preventDefault(); open(); },
    savedEstDraft(m){
      const company=(this.state.data||[]).find(c=>c.id===m.companyId), project=company&&(company.proyectos||[]).find(p=>p.id===m.projectId);
      const e=project&&(project.estimaciones||[]).find(x=>x.id===m.estId);
      return e?this.estDraftFromSaved(e,project):null;
    },
    exportMaestroEstimacion(m,run){ this.setState({maestroEstMenu:null}); if(!this.isPM()) return; const d=this.savedEstDraft(m); if(d) run(d); },
    openMaestroEstimacion(m){ if(!this.isPM()) return; this.setState({maestroEstMenu:null,empresaId:m.companyId,proyectoId:m.projectId,reqId:null},()=>this.openEstimacion(m.estId)); },
    chooseMaestroProject(value){ this.setState({maestroProject:value,maestroProjectMenuOpen:false,maestroStatusMenuOpen:false}); },
    chooseMaestroStatus(value){ this.setState({maestroStatus:value,maestroStatusMenuOpen:false,maestroProjectMenuOpen:false}); },
    setMasterReqCompany(id){ this.setState(s=>({form:{...s.form,empresaId:id,proyectoId:''}})); },
    setMasterReqProject(id){ this.setState(s=>({form:{...s.form,proyectoId:id}})); },
    addReqGlobal(){
      if(!this.isDev()) return;
      const first=this.statusOrder().flow[0]||REQ_STATUS.development;
      this.openModal({type:MODAL.requirement,mode:MODAL_MODE.create,global:true,title:'Nuevo requerimiento',form:{empresaId:this.state.empresaId||'',proyectoId:'',codigos:[''],titulo:'',descripcionCambios:'',observaciones:'',fechaInicioRequerimiento:'',fechaEntregaUsuario:'',fechaPasoProduccion:'',horas:'',responsables:[],estado:first,...BOARD_EXT.emptyExtendedForm(),}});
    },
    openReqFromMaster(companyId, projectId, reqId){
      const company=(this.state.data||[]).find(c=>c.id===companyId);
      const project=company&&(company.proyectos||[]).find(p=>p.id===projectId);
      const req=project&&(project.requerimientos||[]).find(r=>r.id===reqId);
      if(!company||!project||!req) return;
      const code=this.reqCodeLabel(req)||'Sin codigo', title=(req.titulo||'').trim()||code;
      const context='#'+code+' - '+company.nombre+' / '+project.nombre;
      const form={codigos:this.reqFormCodes(req),titulo:req.titulo||'',descripcionCambios:req.descripcionCambios||'',observaciones:req.observaciones||'',fechaInicioRequerimiento:req.fechaInicioRequerimiento||'',fechaEntregaUsuario:req.fechaEntregaUsuario||'',fechaPasoProduccion:req.fechaPasoProduccion||'',horas:req.horas??'',responsables:req.responsables||this.parseOwners(req.responsable),estado:req.estado,...BOARD_EXT.extendedFormFromReq(req)};
      const ctx={empresaId:companyId,proyectoId:projectId,reqId,view:VIEW.master};
      const env=this.reqEnvByStageElseLatestDeploy(company,project,req);
      const envDetail={companyId,projectId,hasEnv:!!env,envLabel:env?env.label:'',envVersion:env&&env.version?'Versión '+env.version:'',hasEnvVersion:!!(env&&env.version),envUrl:env?env.url:'',hasEnvUrl:!!(env&&env.url),openEnvLabel:env?'Abrir en '+env.label:''};
      if(this.isDev()) this.setState({...ctx,modal:{type:MODAL.requirement,mode:MODAL_MODE.edit,id:req.id,title:'Editar requerimiento',displayTitle:title,reqContext:context,form},form});
      else this.setState({...ctx,modal:{type:MODAL.masterReadOnly,title,reqContext:context,detail:{...envDetail,company:company.nombre,project:project.nombre,code,title,description:req.descripcionCambios||'',descriptionBlocks:this.formatRequirementDescription(req.descripcionCambios||''),hasDescription:!!(req.descripcionCambios||'').trim(),descriptionMissing:!(req.descripcionCambios||'').trim(),status:this.estMeta(req.estado)[0],statusHelp:this.masterStatusHelp(req.estado),observations:req.observaciones||'No hay observaciones registradas todavia.',delivery:req.fechaEntregaUsuario?this.parseLocalDate(req.fechaEntregaUsuario).toLocaleDateString(LOCALE):'Aun no se ha definido',productionDate:req.fechaPasoProduccion?this.parseLocalDate(req.fechaPasoProduccion).toLocaleDateString(LOCALE):'Aun no se ha definido',hours:req.horas!==''&&req.horas!=null?req.horas+' horas':'Sin definir',owner:req.responsable||'No asignado',ownerTags:this.parseOwners(req.responsable).map(name=>({name,initials:this.iniciales(name)})),noOwners:!this.parseOwners(req.responsable).length}},form:{}});
    },
    reqEnvByStageElseLatestDeploy(company, project, req){
      const sameEnv=(d,a)=>d.environmentId?d.environmentId===a.id:String(d.env||'').trim().toLowerCase()===String(a.code||'').trim().toLowerCase();
      const reqDeps=(req.despliegues||[]).filter(d=>d.url);
      const amb=(company.ambientes||[]).find(a=>a.stage&&a.stage===req.estado);
      if(amb){ const d=reqDeps.find(d=>sameEnv(d,amb))||((project.recursos||{}).despliegues||[]).find(d=>d.environmentId===amb.id&&d.url)||{}; return {label:amb.label,url:d.url||'',version:d.version||''}; }
      if(reqDeps.length){ const d=reqDeps.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]; const a=(company.ambientes||[]).find(a=>sameEnv(d,a)); return {label:(a&&a.label)||d.env,url:d.url,version:d.version||''}; }
      return null;
    },
    async exportMaestroExcel(items){
      if(!this.canDownloadBoardExcel()||this.state.exportingExcel) return;
      this.setState({exportingExcel:true});
      try{
        const XLSX=await this.loadXlsx();
        const sortableExcelSerial=(y,m,d,h=0,mi=0)=>(Date.UTC(y,m-1,d,h,mi)-EXCEL.epochUtc)/MS_PER_DAY;
        const day=v=>{ const p=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||''); return p?sortableExcelSerial(+p[1],+p[2],+p[3]):null; };
        const stamp=v=>{ const d=v?new Date(v):null; return d&&!isNaN(d)?sortableExcelSerial(d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes()):null; };
        const cols=[
          ['Fecha de inicio',16,EXCEL.dateFormat],['Aplicación',26],['#Req',22],['Título',45],['Descripción de cambios',60],['Horas estimadas',10],
          ['Estado',14],['Observaciones',45],['Responsables',28],['Entrega usuario',13,EXCEL.dateFormat],['Paso a producción',13,EXCEL.dateFormat],['Último cambio de estado',17,EXCEL.dateTimeFormat],
        ];
        const extCompany=this.canSeeExtended(this.empresa())?this.empresa():null;
        const extContacts={}; ((extCompany&&extCompany.contactos)||[]).forEach(c=>{ extContacts[c.id]=c; });
        if(extCompany) BOARD_EXT.EXTENDED_EXCEL_COLUMNS.forEach(([header,width,kind])=>cols.push(kind==='date'?[header,width,EXCEL.dateFormat]:[header,width]));
        const rows=items.map(({project,req})=>{
          const codes=this.reqCodesOf(req), code=codes.length>1?codes.join(', '):(codes[0]||''), horas=req.horas===''||req.horas==null?null:Number(req.horas);
          return [day(req.fechaInicioRequerimiento), project.nombre, /^\d+$/.test(code)?Number(code):code, req.titulo||'', (req.descripcionCambios||'').trim(), horas!=null&&isNaN(horas)?req.horas:horas,
            this.estMeta(req.estado)[0], (req.observaciones||'').trim(), (req.responsables||this.parseOwners(req.responsable)).join(', '),
            day(req.fechaEntregaUsuario), day(req.fechaPasoProduccion), stamp(req.estadoActualizadoAt),
            ...(extCompany?BOARD_EXT.extendedExcelValues(req,extContacts).map((v,i)=>BOARD_EXT.EXTENDED_EXCEL_COLUMNS[i][2]==='date'?day(v):v):[])];
        });
        const ws=XLSX.utils.aoa_to_sheet([cols.map(c=>c[0]),...rows]);
        cols.forEach(([,,fmt],c)=>{ if(fmt) rows.forEach((_,r)=>{ const cell=ws[XLSX.utils.encode_cell({r:r+1,c})]; if(cell&&cell.t===EXCEL.numberCellType) cell.z=fmt; }); });
        ws['!cols']=cols.map(c=>({wch:c[1]}));
        ws['!autofilter']={ref:ws['!ref']};
        const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Requerimientos');
        const t=new Date(), pad=n=>String(n).padStart(2,'0');
        XLSX.writeFile(wb,FILE_NAME.requirementsPrefix+t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate())+EXCEL.extension);
      }catch(e){ console.error(e); this.setState({modal:{type:MODAL.notice,title:'No se pudo generar el Excel',mensaje:e.message||'Intenta de nuevo.'},form:{}}); }
      finally{ this.setState({exportingExcel:false}); }
    },
    masterStatusHelp(statusId){
      const label=this.estMeta(statusId)[0].toLocaleLowerCase(LOCALE);
      if(label.includes(STATUS_LABEL_HINT.development)) return 'El equipo esta trabajando en este cambio.';
      if(label.includes(STATUS_LABEL_HINT.userTesting)||label.includes(STATUS_LABEL_HINT.testing)||label===STATUS_LABEL_HINT.qa) return 'El cambio esta en revision o pruebas con los usuarios.';
      if(label.includes(STATUS_LABEL_HINT.productionStrict)) return 'El cambio ya esta disponible en produccion.';
      if(label.includes(STATUS_LABEL_HINT.blocked)) return 'El avance esta detenido hasta resolver un bloqueo.';
      return 'Esta es la etapa actual del requerimiento.';
    },
  });
})();
