(function () {
  const { VIEW, SAVE_STATUS, THEME } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    themeVals(ctx){
      const R={};
      R.isDark=document.documentElement.classList.contains(THEME.darkClass); R.themeTitle=R.isDark?'Cambiar a modo claro':'Cambiar a modo oscuro'; R.toggleDarkMode=()=>this.toggleDarkMode();
      return R;
    },
    userMenuVals(ctx){
      const { s } = ctx;
      const R={};
      R.userMenuOpen=!!s.userMenuOpen; R.toggleUserMenu=()=>this.toggleUserMenu(); R.closeUserMenu=()=>this.closeUserMenu();
      R.openPasswordModalFromMenu=()=>this.openPasswordModalFromMenu();
      return R;
    },
    saveVals(ctx){
      const { s } = ctx;
      const R={};
      const ss=s.saveStatus||SAVE_STATUS.idle;
      R.showSave = ss!==SAVE_STATUS.idle;
      R.saveLabelTxt = ss===SAVE_STATUS.saving?'Guardando…':(ss===SAVE_STATUS.error?'Error al guardar':'Guardado');
      R.saveDot = ss===SAVE_STATUS.saving?'var(--gp-cyan)':(ss===SAVE_STATUS.error?'var(--gp-red)':'var(--gp-green)');
      R.saveTextColor = ss===SAVE_STATUS.error?'var(--gp-red)':'var(--gp-muted)';
      return R;
    },
    crumbsVals(ctx){
      const { s, v, emp, proy, req } = ctx;
      const R={};
      const crumbs=[{label:'Empresas',go:()=>this.goHome(),color:v===VIEW.companies?'var(--gp-text)':'var(--gp-muted)',weight:v===VIEW.companies?600:400,sep:false}];
      if(emp && v!==VIEW.companies){ crumbs.push({label:emp.nombre,go:()=>this.goProyectos(),color:v===VIEW.projects?'var(--gp-text)':'var(--gp-muted)',weight:v===VIEW.projects?600:400,sep:true}); }
      if(v===VIEW.master){ crumbs.push({label:'Gestión de proyectos',go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(proy && (v===VIEW.project||v===VIEW.requirements||v===VIEW.requirement||v===VIEW.apiDoc||v===VIEW.estimations||v===VIEW.estimation)){ crumbs.push({label:proy.nombre,go:()=>this.goProyecto(),color:v===VIEW.project?'var(--gp-text)':'var(--gp-muted)',weight:v===VIEW.project?600:400,sep:true}); }
      if(v===VIEW.apiDoc){ crumbs.push({label:'Documentación Técnica',go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(v===VIEW.settings){ crumbs.push({label:'Configuración',go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(v===VIEW.requirements){ crumbs.push({label:'Requerimientos',go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(v===VIEW.requirement&&req){ crumbs.push({label:'Requerimientos',go:()=>this.goRequerimientos(),color:'var(--gp-muted)',weight:400,sep:true}); crumbs.push({label:this.reqCodeLabel(req)||req.titulo,go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(v===VIEW.estimations){ crumbs.push({label:'Estimaciones',go:()=>{},color:'var(--gp-text)',weight:600,sep:true}); }
      if(v===VIEW.estimation&&s.estDraft){
        const d=s.estDraft;
        crumbs.push({label:'Estimaciones',go:()=>this.goEstimaciones(),color:'var(--gp-muted)',weight:400,sep:true});
        crumbs.push({label:(d.code||'').trim()||(d.initiativeName||'').trim()||'Nueva estimación',go:()=>{},color:'var(--gp-text)',weight:600,sep:true});
        R.goHome=ctx.goHome; this.guardCrumbsAndLogoAgainstUnsavedExit(crumbs,R);
      }
      R.crumbs=crumbs;

      R.narrow = !!s.narrow;
      R.showSecondBar = R.narrow && crumbs.length>1;
      const prevCrumb = crumbs[crumbs.length-2];
      const lastCrumb = crumbs[crumbs.length-1];
      R.backCrumbLabel = prevCrumb ? prevCrumb.label : 'Atrás';
      R.backCrumbGo = prevCrumb ? prevCrumb.go : (()=>this.goHome());
      R.currentCrumbLabel = lastCrumb ? lastCrumb.label : '';
      return R;
    },
    primaryVals(ctx){
      const { v, isDev } = ctx;
      const R={};
      const wantsPrimary = v===VIEW.companies||v===VIEW.projects||v===VIEW.requirements||v===VIEW.master||v===VIEW.estimations;
      R.hasPrimary = wantsPrimary && isDev;
      R.hasPrimaryLocked = wantsPrimary && !isDev;
      R.primaryPad = ctx.narrow ? '9px' : '9px 15px';
      if(v===VIEW.companies){ R.primaryLabel='Nueva empresa'; R.primaryAction=()=>this.addEmpresa(); }
      else if(v===VIEW.projects){ R.primaryLabel='Nuevo proyecto'; R.primaryAction=()=>this.addProyecto(); }
      else if(v===VIEW.requirements){ R.primaryLabel='Nuevo requerimiento'; R.primaryAction=()=>this.addReq(); }
      else if(v===VIEW.master){ R.primaryLabel='Nuevo requerimiento'; R.primaryAction=()=>this.addReqGlobal(); }
      else if(v===VIEW.estimations){ R.primaryLabel='Nueva estimación'; R.primaryAction=()=>this.newEstimacion(); }
      return R;
    }
  });
})();
