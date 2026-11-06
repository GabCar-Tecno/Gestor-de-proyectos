(function () {
  const { VIEW, REQ_TAB, NEW_TAB } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    empresa(){ return this.state.data.find(e=>e.id===this.state.empresaId); },
    proyecto(){ const e=this.empresa(); return e && e.proyectos.find(p=>p.id===this.state.proyectoId); },
    req(){ const p=this.proyecto(); return p && p.requerimientos.find(r=>r.id===this.state.reqId); },
    goHome(){ this.setState({view:VIEW.companies,proyectoId:null,reqId:null}); },
    openEmpresa(id){ this.setState({empresaId:id,view:VIEW.projects,proyectoId:null,reqId:null}); },
    openProyecto(id){ this.setState({proyectoId:id,view:VIEW.project,reqId:null}); },
    goProyectos(){ this.setState({view:VIEW.projects,proyectoId:null,reqId:null}); },
    goConfiguracion(){ if(!this.isDev()) return; this.setState({view:VIEW.settings,proyectoId:null,reqId:null}); },
    goProyecto(){ this.setState({view:VIEW.project,reqId:null}); },
    goRequerimientos(){ if(!this.isDev()) return; this.setState({view:VIEW.requirements}); },
    goEstimaciones(){ if(!this.isDev()) return; this.setState({view:VIEW.estimations,estimacionId:null,estDraft:null}); },
    goMaestro(){ this.setState({view:VIEW.master,proyectoId:null,reqId:null,reqSelectMode:false,reqSelected:{},maestroEstMenu:null}); },
    openReq(id){ if(!this.isDev()) return; this.setState({reqId:id,view:VIEW.requirement,reqTab:REQ_TAB.documents}); },
    setReqTab(t){ this.setState({reqTab:t}); },
    setFilter(f){ this.setState({filter:f}); },
    openExt(u){ if(u) window.open(u,NEW_TAB.target); },
    goProyectoFromMaster(companyId,projectId){ this._documentFile=null; this.setState({modal:null,form:{},documentFileName:'',empresaId:companyId,proyectoId:projectId,view:VIEW.project,reqId:null}); },
    setProjectsView(v){ this.setState({projectsView:v}); },
    guardCrumbsAndLogoAgainstUnsavedExit(crumbs,R){
      crumbs.slice(0,-1).forEach(c=>{ const go=c.go; c.go=()=>this.leaveEstimacion(go); });
      const home=R.goHome; R.goHome=()=>this.leaveEstimacion(home);
    }
  });
})();
