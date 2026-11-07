(function () {
  const { VIEW, API_TAB, SAVE_STATUS, TABLE, DELAY_MS, ICON } = window.APP_CONSTANTS;

  window.ROOT_MIXINS.push({
    openApiDoc(){ clearTimeout(this._redocWaitT); this._redocWaitSpec=null; const p=this.proyecto(); const spec=(p.recursos&&p.recursos.apiSpec)||{}; this.setState({view:VIEW.apiDoc, apiUrlInput:spec.source===API_TAB.url?(spec.url||''):'', apiErr:'', apiHasRender:!!spec.source}); this._pendingSpec=spec.source?spec:null; },
    waitForRedoc(spec){ clearTimeout(this._redocWaitT); this._redocWaitSpec=spec; const started=Date.now(); const tick=()=>{ if(this._redocWaitSpec!==spec) return; if(window.Redoc){ this._redocWaitSpec=null; this.renderSpec(spec); return; } if(Date.now()-started>=DELAY_MS.redocLoadTimeout){ this._redocWaitSpec=null; this.setState({apiErr:'No se pudo cargar Redoc (revisa tu conexión).'}); return; } this._redocWaitT=setTimeout(tick,DELAY_MS.redocLoadPoll); }; tick(); },
    renderSpec(spec){ const el=this._redocEl; if(!el) return; if(!window.Redoc){ this.waitForRedoc(spec); return; } const opts={hideDownloadButton:!this.isDev()}; try{ el.replaceChildren(); if(spec.source===API_TAB.url){ window.Redoc.init(spec.url,opts,el,(err)=>{ if(err){ this.setState({apiErr:'No se pudo cargar la spec: no se encontró el archivo en esa ruta.'}); } }); } else { const obj=JSON.parse(spec.json); window.Redoc.init(obj,opts,el); } }catch(e){ this.setState({apiErr:'Error al renderizar: '+e.message}); } },
    toggleApiFullscreen(){ const el=this._redocContainerEl; if(!el) return; if(document.fullscreenElement){ document.exitFullscreen(); } else if(el.requestFullscreen){ el.requestFullscreen(); } },
    async saveApiUrl(){
      if(!this.isDev()||this._busy) return; this._busy=true;
      try{ await this._saveApiUrl(); } finally{ this._busy=false; }
    },
    async _saveApiUrl(){
      const url=(this.state.apiUrlInput||'').trim(); if(!url){ this.setState({apiErr:'Ingresa la ruta del archivo.'}); return; }
      const spec={source:API_TAB.url,url};
      this.setState({apiErr:'',apiHasRender:true,saveStatus:SAVE_STATUS.saving});
      const { error } = await this._sb.from(TABLE.projects).update({api_spec_source:API_TAB.url, api_spec_url:url, api_spec_json:null}).eq('id',this.state.proyectoId);
      this.setState({saveStatus:error?SAVE_STATUS.error:SAVE_STATUS.saved});
      if(error){ this.setState({apiErr:'No se pudo guardar: '+error.message}); return; }
      await this.loadData();
      this._pendingSpec=spec; this.setState({apiErr:''});
    },
    apiDocVals(ctx){
      const { s, v } = ctx;
      const R={};
      R.viewApidoc=v===VIEW.apiDoc;
      R.mainMaxW= v===VIEW.apiDoc ? '1800px' : (v===VIEW.estimation ? '1500px' : (v===VIEW.master&&ctx.maestroExtended ? '1600px' : '1240px'));
      R.apiUrlVal=s.apiUrlInput||'';
      R.onApiUrl=(e)=>this.setState({apiUrlInput:e.target.value});
      R.saveApiUrl=()=>this.saveApiUrl();
      R.apiErr=s.apiErr||''; R.apiErrShow=!!s.apiErr;
      R.redocDisplay=(v===VIEW.apiDoc&&s.apiHasRender)?'block':'none';
      R.apiEmptyShow=v===VIEW.apiDoc&&!s.apiHasRender;
      R.showFullscreenBtn=v===VIEW.apiDoc&&!!s.apiHasRender;
      R.toggleFullscreen=()=>this.toggleApiFullscreen();
      R.fullscreenTitle=s.apiFullscreen?'Salir de pantalla completa':'Pantalla completa';
      R.fullscreenIconHref=ICON.expand;
      R.redocRef=(el)=>{ this._redocEl=el; const spec=this._pendingSpec; if(el&&spec){ this._pendingSpec=null; setTimeout(()=>this.renderSpec(spec),0); } };
      R.redocContainerRef=(el)=>{ this._redocContainerEl=el; };
      return R;
    }
  });
})();
