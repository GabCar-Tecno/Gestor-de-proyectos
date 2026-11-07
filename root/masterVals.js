(function () {
  const { VIEW, FILTER_ALL, LOCALE, MASTER_STATUS_GROUP, STATUS_LABEL_HINT } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    masterVals(ctx){
      const { s, v, isDev, isPM } = ctx;
      const R={};
      R.goMaestro=()=>this.goMaestro();
      R.viewMaestro=v===VIEW.master; R.maestroSoloLectura=!isDev;
      if(!R.viewMaestro) return R;
      const all=[], envIndexOf=new Map();
      (s.data||[]).filter(company=>!s.empresaId||company.id===s.empresaId).forEach(company=>{ envIndexOf.set(company,this.indexById(company.ambientes)); (company.proyectos||[]).forEach(project=>(project.requerimientos||[]).forEach(req=>all.push({company,project,req}))); });
      const q=(s.maestroSearch||'').trim().toLocaleLowerCase(LOCALE);
      const stateText=(id)=>{const st=this.statusById(id);return ((st&&st.label)||id||'').toLocaleLowerCase(LOCALE);};
      const stateGroup=(id)=>{const x=stateText(id);return x.includes(STATUS_LABEL_HINT.blocked)?MASTER_STATUS_GROUP.blocked:x.includes(STATUS_LABEL_HINT.estimation)?MASTER_STATUS_GROUP.estimation:x.includes(STATUS_LABEL_HINT.production)?MASTER_STATUS_GROUP.production:x.includes(STATUS_LABEL_HINT.userTesting)||x.includes(STATUS_LABEL_HINT.testing)||x===STATUS_LABEL_HINT.qa?MASTER_STATUS_GROUP.userTesting:x.includes(STATUS_LABEL_HINT.development)?MASTER_STATUS_GROUP.development:MASTER_STATUS_GROUP.other;};
      const statusOptions=[{value:FILTER_ALL,label:'Todos los estados',dot:'var(--gp-dot)'},...(s.statuses||[]).map(st=>({value:st.id,label:BOARD_EXT.statusLabel(this.empresa(),st.id,st.label||st.id),dot:st.color||'var(--gp-dot)'}))];
      const listedProjects=new Set();
      const projectOptions=all.filter(({project})=>!listedProjects.has(project.id)&&listedProjects.add(project.id)).map(({company,project})=>({value:project.id,label:project.nombre+' · '+company.nombre})).sort((a,b)=>a.label.localeCompare(b.label,LOCALE));
      const allProjectOptions=[{value:FILTER_ALL,label:'Todas las aplicaciones'},...projectOptions];
      R.maestroProjectMenuOpen=!!s.maestroProjectMenuOpen; R.maestroStatusMenuOpen=!!s.maestroStatusMenuOpen;
      R.toggleMaestroProjectMenu=()=>this.toggleMaestroProjectMenu(); R.toggleMaestroStatusMenu=()=>this.toggleMaestroStatusMenu();
      R.closeMaestroProjectMenu=()=>this.closeMaestroProjectMenu(); R.closeMaestroStatusMenu=()=>this.closeMaestroStatusMenu();
      R.maestroProject=allProjectOptions.some(x=>x.value===s.maestroProject)?s.maestroProject:FILTER_ALL;
      R.maestroProjectLabel=(allProjectOptions.find(x=>x.value===R.maestroProject)||allProjectOptions[0]).label;
      R.maestroProjectOptions=allProjectOptions.map(app=>{const selected=R.maestroProject===app.value;return Object.assign({},app,{selected,bg:selected?'var(--gp-tint-strong)':'transparent',color:selected?'var(--gp-ink)':'var(--gp-text-2)',weight:selected?600:500,choose:()=>this.chooseMaestroProject(app.value)});});
      R.maestroSearch=s.maestroSearch||'';
      R.maestroStatus=statusOptions.some(x=>x.value===s.maestroStatus)?s.maestroStatus:FILTER_ALL;
      R.maestroStatusLabel=(statusOptions.find(x=>x.value===R.maestroStatus)||statusOptions[0]).label;
      R.maestroStatusOptions=statusOptions.map(st=>{const selected=R.maestroStatus===st.value;return Object.assign({},st,{selected,bg:selected?'var(--gp-tint-strong)':'transparent',color:selected?'var(--gp-ink)':'var(--gp-text-2)',weight:selected?600:500,choose:()=>this.chooseMaestroStatus(st.value)});});
      R.setMaestroSearch=e=>this.setMaestroSearch(e);
      const filtered=all.filter(({company,project,req})=>{
        if(R.maestroStatus!==FILTER_ALL&&req.estado!==R.maestroStatus) return false;
        if(R.maestroProject!==FILTER_ALL&&project.id!==R.maestroProject) return false;
        if(!q) return true;
        return [company.nombre,project.nombre,this.reqCodeLabel(req),req.titulo,req.descripcionCambios,req.observaciones,req.responsable].some(x=>(x||'').toLocaleLowerCase(LOCALE).includes(q));
      });
      filtered.sort(this.byBoardStageThenReqCodeDesc());
      R.maestroCount=all.length;
      R.maestroVisibleCount=filtered.length;
      R.exportingExcel=!!s.exportingExcel; R.exportExcelLabel=s.exportingExcel?'Generando…':'Descargar Excel';
      R.exportMaestroExcel=()=>this.exportMaestroExcel(filtered);
      const groupCounts={};
      all.forEach(({req})=>{ const group=stateGroup(req.estado); groupCounts[group]=(groupCounts[group]||0)+1; });
      const stateCount=(group)=>groupCounts[group]||0;
      const estimacionMeta=this.estMeta(this.estimationStatusId());
      R.maestroStatusCounts=[
        {label:'Estimación',count:stateCount(MASTER_STATUS_GROUP.estimation),color:estimacionMeta[1],tint:estimacionMeta[2]},
        {label:'En desarrollo',count:stateCount(MASTER_STATUS_GROUP.development),color:'var(--gp-metric-dev)',tint:'var(--gp-metric-dev-tint)'},
        {label:'Pruebas usuario',count:stateCount(MASTER_STATUS_GROUP.userTesting),color:'var(--gp-metric-qa)',tint:'var(--gp-metric-qa-tint)'},
        {label:'Producción',count:stateCount(MASTER_STATUS_GROUP.production),color:'var(--gp-success)',tint:'var(--gp-metric-prod-tint)'},
        {label:'Bloqueados',count:stateCount(MASTER_STATUS_GROUP.blocked),color:'var(--gp-metric-block)',tint:'var(--gp-metric-block-tint)'},
      ];
      R.maestroExtended=this.canSeeExtended(this.empresa());
      R.maestroNormal=!R.maestroExtended;
      R.maestroTableClass=['master-table--scroll',R.maestroExtended?'master-table--extended':'',isPM?'master-table--est':''].filter(Boolean).join(' ');
      const estMenu=isPM?s.maestroEstMenu:null;
      R.maestroEstMenuOpen=!!estMenu;
      R.closeMaestroEstMenu=()=>this.closeMaestroEstMenu();
      R.maestroEstMenuStyle=estMenu?'--master-est-left:'+estMenu.left+';--master-est-top:'+estMenu.top+';--master-est-bottom:'+estMenu.bottom:'';
      R.maestroEstOptions=estMenu?[
        {label:'Descargar Excel',choose:()=>this.exportMaestroEstimacion(estMenu,d=>this.exportEstimacion(d))},
        {label:'Descargar PDF',choose:()=>this.exportMaestroEstimacion(estMenu,d=>this.exportEstimacionPdfViaPrintDialog(d))},
        {label:'Abrir estimación',choose:()=>this.openMaestroEstimacion(estMenu)},
      ]:[];
      R.maestroTopScroll=e=>this.startMaestroThumbDrag(e);
      R.maestroTableScroll=()=>this.syncMaestroThumb();
      requestAnimationFrame(()=>requestAnimationFrame(()=>this.syncMaestroThumb()));
      if(!this._maestroResizeBound){ this._maestroResizeBound=true; window.addEventListener('resize',()=>this.syncMaestroThumb()); }
      R.maestroReqList=filtered.map(({company,project,req})=>{
        const meta=this.estMeta(req.estado), count=this.activeBloq(req);
        const deliveries=(req.despliegues||[]).filter(d=>d.updatedAt).map(d=>({d,amb:envIndexOf.get(company).get(d.environmentId)}));
        const userDelivery=deliveries.find(x=>((x.amb&&this.estMeta(x.amb.stage)[0])||'').toLocaleLowerCase(LOCALE).includes(STATUS_LABEL_HINT.userTesting)||((x.amb&&x.amb.label)||x.d.env||'').toLocaleLowerCase(LOCALE).includes(STATUS_LABEL_HINT.userTesting));
        const explicitDate=req.fechaEntregaUsuario?this.parseLocalDate(req.fechaEntregaUsuario).toLocaleDateString(LOCALE):
          (userDelivery?new Date(userDelivery.d.updatedAt).toLocaleDateString(LOCALE):'Sin definir');
        const est=isPM?this.latestEstimacionOf(project,req.id):null;
        const openReq=()=>this.openReqFromMaster(company.id,project.id,req.id);
        return {
          hasEstimation:!!est, estMenuOpen:!!est&&!!estMenu&&estMenu.estId===est.id,
          toggleEstMenu:est?e=>this.toggleMaestroEstMenu(e,company.id,project.id,est.id):null,
          openKey:e=>this.maestroRowKey(e,openReq),
          empresa:company.nombre, proyecto:project.nombre,
          code:this.reqCodeLabel(req)||this.fallbackReqCode((project.requerimientos||[]).findIndex(x=>x.id===req.id)), titulo:req.titulo,
          descripcion:(req.descripcionCambios||'').trim()||req.titulo||'Sin descripción registrada',
          observaciones:(req.observaciones||'').trim()||'—', sinObservaciones:!(req.observaciones||'').trim(), fechaEntregaUsuario:explicitDate,
          fechaPasoProduccion:req.fechaPasoProduccion?this.parseLocalDate(req.fechaPasoProduccion).toLocaleDateString(LOCALE):'Sin definir', productionDateColor:req.fechaPasoProduccion?'var(--gp-success)':'var(--gp-muted-3)',
          responsable:req.responsable, estado:meta[0], estadoColor:meta[1], estadoBg:meta[2],
          bloqLabel:count?count+' bloqueante'+(count===1?'':'s')+' activo'+(count===1?'':'s'):'Sin bloqueantes',
          bloqColor:count?'var(--gp-red)':'var(--gp-muted-2)', deliveryColor:req.fechaEntregaUsuario||userDelivery?'var(--gp-success)':'var(--gp-muted-3)',
          openTitle:this.isDev()?'Abrir y editar requerimiento':'Consultar requerimiento', open:openReq,
          horasTxt:this.hoursText(req),
          ext:R.maestroExtended?this.extendedDisplay(company,req):{},
        };
      });
      R.maestroEmpty=filtered.length===0;
      return R;
    },
  });
})();
