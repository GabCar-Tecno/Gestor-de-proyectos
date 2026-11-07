(function () {
  const { PROJECTS_VIEW, FILTER_ALL, ICON, COPY_KEY, DEPLOYABLE_KIND } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    projectsVals(ctx){
      const { s, emp } = ctx;
      const R={};
      if(!emp) return R;
      const ord=this.statusOrder();
      const pv=s.projectsView||PROJECTS_VIEW.grid;
      R.projectsGrid=pv!==PROJECTS_VIEW.list; R.projectsListView=pv===PROJECTS_VIEW.list;
      R.setProjectsGrid=()=>this.setProjectsView(PROJECTS_VIEW.grid); R.setProjectsListView=()=>this.setProjectsView(PROJECTS_VIEW.list);
      R.pvGridBg=pv!==PROJECTS_VIEW.list?'var(--gp-cyan-16)':'transparent'; R.pvGridColor=pv!==PROJECTS_VIEW.list?'var(--gp-cyan)':'var(--gp-muted)';
      R.pvListBg=pv===PROJECTS_VIEW.list?'var(--gp-cyan-16)':'transparent'; R.pvListColor=pv===PROJECTS_VIEW.list?'var(--gp-cyan)':'var(--gp-muted)';
      R.proyectosList=emp.proyectos.map(p=>{
        const reqs=p.requerimientos; const tot=reqs.length||1;
        const counts={}; ord.canonical.forEach(k=>counts[k]=0); reqs.forEach(r=>{ if(counts[r.estado]!=null) counts[r.estado]++; });
        const order=ord.reversed;
        const barra=order.filter(k=>counts[k]>0).map(k=>({w:(counts[k]/tot*100)+'%',color:this.estMeta(k)[1]}));
        const estadoChips=order.filter(k=>counts[k]>0).map(k=>({label:this.estMeta(k)[0],color:this.estMeta(k)[1],n:counts[k]}));
        const bloq=reqs.reduce((a,r)=>a+this.activeBloq(r),0);
        const ultimo=(p.recursos.despliegues||[]).reduce((max,d)=> (d.updatedAt && (!max || d.updatedAt>max)) ? d.updatedAt : max, null);
        return { id:p.id,nombre:p.nombre,descripcion:p.descripcion,totalReq:reqs.length,barra, estadoChips, bloqCount:bloq, bloqColor:bloq>0?'var(--gp-red)':'var(--gp-muted)', ultimoDespliegue: ultimo?this.relDate(ultimo):'Sin despliegues', open:()=>this.openProyecto(p.id) };
      });
      return R;
    },
    projectVals(ctx){
      const { s, isDev, emp, proy } = ctx;
      const R={};
      if(!proy) return R;
      const reqs=proy.requerimientos;
      const ord=this.statusOrder();
      const counts={}; ord.canonical.forEach(k=>counts[k]=0); reqs.forEach(r=>{ if(counts[r.estado]!=null) counts[r.estado]++; });
      const barraOrder=ord.canonical;
      const reqBarra=barraOrder.filter(k=>counts[k]>0).map(k=>({f:counts[k],color:this.estMeta(k)[1]}));
      const chipOrder=ord.canonical;
      const estadoChips=chipOrder.map((k,i)=>{ const c=this.estMeta(k)[1], n=counts[k], z=n===0, last=i===chipOrder.length-1; return {label:this.estMeta(k)[0],n,color:z?'var(--gp-dot)':c,labelColor:z?'var(--gp-muted)':'var(--gp-text-2)',pr:last?'0':'18px',bd:last?'none':'1px solid var(--gp-line-18)'}; });
      const rec=proy.recursos;
      const cardOf=(key,label,iconHref)=>{ const url=(rec[key]||{}).url; return {label,iconHref,status:url?'Enlazado':'Sin enlace',statusColor:url?'var(--gp-green)':'var(--gp-muted-2)',open: isDev ? ()=>this.openRecurso(key,label,iconHref) : ()=>this.openExt(url)}; };
      const ghCount=(rec.github||[]).length;
      const githubCard={label:'GitHub',iconHref:ICON.external,status:ghCount?(ghCount+' repo'+(ghCount===1?'':'s')):'Sin repos',statusColor:ghCount?'var(--gp-green)':'var(--gp-muted-2)',open: isDev ? ()=>this.editGithubLinks() : ()=>this.openVerGithubLinks()};
      const apiHasSpec=!!(rec.apiSpec&&rec.apiSpec.source);
      const estCount=(proy.estimaciones||[]).length;
      const estimacionesCard={label:'Estimaciones',iconHref:ICON.chart,status:estCount?(estCount+(estCount===1?' estimación':' estimaciones')):'Sin estimaciones',statusColor:estCount?'var(--gp-green)':'var(--gp-muted-2)',open:()=>this.goEstimaciones()};
      R.proyecto={
        nombre:proy.nombre, descripcion:proy.descripcion, totalReq:reqs.length, estadoChips, reqBarra,
        despliegues:rec.despliegues.map(d=>{
          const k=COPY_KEY.projectDeploymentPrefix+d.env; const copied=s.copiedKey===k;
          return { env:d.env, version:d.version||'—',
            openDetail:()=>this.openVerDespliegue(d.env,d.url,d.version,d.environmentId),
            copy:(e)=>{e.stopPropagation();this.copyToClipboard(d.url,k);},
            copyIconHref: copied?ICON.check:ICON.copy,
            copyColor: copied?'var(--gp-green)':'var(--gp-muted-2)',
            copyBg: copied?'var(--gp-green-12)':'transparent',
            copyBorder: copied?'var(--gp-green-40)':'var(--gp-line-18)',
            copyTitle: copied?'Copiado':'Copiar URL' };
        }),
        recursoCards:[ ...(isDev ? [cardOf('manualTecnico','Manual Técnico',ICON.book)] : []), cardOf('diagramas','Diagramas',ICON.diagram), cardOf('manualUsuario','Manual de Usuario',ICON.userGuide), githubCard, ...((isDev||apiHasSpec) ? [{label:'Documentación Técnica',iconHref:ICON.api,status:apiHasSpec?'Configurado':'Sin spec',statusColor:apiHasSpec?'var(--gp-green)':'var(--gp-muted-2)',open:()=>this.openApiDoc()}] : []), ...(isDev ? [estimacionesCard] : []) ],
        credenciales:(rec.credenciales||[]).map(c=>{
          const shown=!!s.credShown[c.id]; const k=COPY_KEY.credentialPrefix+c.id; const copied=s.copiedKey===k;
          return { label:c.label||'(sin nombre)',
            hasEnv:!!c.envLabel, envLabel:c.envLabel||'',
            hasUsername:!!(c.username&&c.username.trim()), username:c.username||'',
            hasNotes:!!(c.notes&&c.notes.trim()), notes:c.notes||'',
            hasUrl:!!(c.url&&c.url.trim()),
            secretText: shown ? (c.secret||'—') : '••••••••',
            eyeHref: this.passwordToggleIcon(shown),
            toggleTitle: shown?'Ocultar':'Mostrar',
            toggle:()=>this.toggleCredShown(c.id),
            open:()=>this.openExt(c.url),
            copy:()=>this.copyToClipboard(c.secret,k),
            copyIconHref: copied?ICON.check:ICON.copy,
            copyColor: copied?'var(--gp-green)':'var(--gp-muted-2)',
            copyBg: copied?'var(--gp-green-12)':'transparent',
            copyBorder: copied?'var(--gp-green-40)':'var(--gp-line-18)',
            copyTitle: copied?'Copiado':'Copiar contraseña' };
        }),
      };
      R.credsEmpty=!(rec.credenciales||[]).length;

      const _pDeps=(emp&&emp.desplegables)||[];
      const _pSrvById={}; ((emp&&emp.servidores)||[]).forEach(x=>{ _pSrvById[x.id]=x; });
      const _kindMeta=(k)=> k===DEPLOYABLE_KIND.gateway ? ['Gateway','var(--gp-violet)','var(--gp-violet-16)']
                          : k===DEPLOYABLE_KIND.app     ? ['App','var(--gp-amber)','var(--gp-amber-16)']
                          :                 ['API','var(--gp-cyan)','var(--gp-cyan-16)'];
      const _pSel=(proy&&proy.desplegableIds)||[];
      const _pMine=_pDeps.filter(d=>_pSel.includes(d.id));
      R.componentesProyEmpty=!_pMine.length;
      R.componentesProy=_pMine.map(d=>{
        const meta=_kindMeta(d.kind), srv=_pSrvById[d.serverId];
        return { titulo: d.name + (d.port?(':'+d.port):''), servidor: srv?srv.code:'sin servidor',
                 kindLabel:meta[0], kindColor:meta[1], kindBg:meta[2] };
      });
      R.openComponentesProy=()=>this.openComponentesProy();

      const fdef=[[FILTER_ALL,'Todos',null]].concat(ord.canonical.map(k=>[k,this.estMeta(k)[0],k]));
      R.filterChips=fdef.map(([key,label,est])=>{ const count= est? counts[est] : reqs.length; const active=s.filter===key; return { label,count, set:()=>this.setFilter(key), border: active?'var(--gp-cyan-55)':'var(--gp-line-20)', bg: active?'var(--gp-cyan-14)':'transparent', color: active?'var(--gp-cyan)':'var(--gp-text-3)' }; });
      const filtered=(s.filter===FILTER_ALL? reqs.slice() : reqs.filter(r=>r.estado===s.filter)).sort(this.byBoardStageThenReqCodeDesc(r=>r));
      const idx=(id)=> reqs.findIndex(r=>r.id===id);
      const selMode=!!s.reqSelectMode, selMap=s.reqSelected||{};
      const selCount=reqs.filter(r=>selMap[r.id]).length;
      R.reqSelectMode=selMode; R.reqSelToggle=()=>this.toggleReqSelectMode();
      R.reqSelToggleLabel=selMode?'Cancelar selección':'Seleccionar';
      R.reqSelCount=selCount; R.reqSelBarShow=selMode && selCount>0;
      R.reqSelBarLabel=selCount+' seleccionado'+(selCount===1?'':'s');
      R.openBatchPromote=()=>this.openBatchPromote(); R.clearReqSelection=()=>this.clearReqSelection();
      R.reqList=filtered.map(r=>{ const m=this.estMeta(r.estado); const bc=this.activeBloq(r); const chk=!!selMap[r.id]; return { code:this.reqCodeLabel(r)||this.fallbackReqCode(idx(r.id)), titulo:r.titulo, responsable:r.responsable, iniciales:this.iniciales(r.responsable), estLabel:m[0],estColor:m[1],estBg:m[2], tieneBloq:bc>0, bloqCount:bc, selectMode:selMode, selected:chk, checkBg: chk?'var(--gp-cyan)':'transparent', checkBorder: chk?'var(--gp-cyan)':'var(--gp-line-25)', open:(selMode?()=>this.toggleReqSelected(r.id):()=>this.openReq(r.id)) }; });
      R.reqEmpty=filtered.length===0;
      return R;
    }
  });
})();
