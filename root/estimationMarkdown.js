(function () {
  window.ROOT_MIXINS.push({
    additionalMarkdownBlocks(src){
      const lines=String(src||'').replace(/\r\n/g,'\n').split('\n');
      const blocks=[];
      let i=0;
      while(i<lines.length){
        const line=lines[i];
        if(/^\s*```/.test(line)){
          const buf=[]; i++;
          while(i<lines.length && !/^\s*```/.test(lines[i])){ buf.push(lines[i]); i++; }
          if(i<lines.length) i++;
          blocks.push({type:'code', text:buf.join('\n')});
          continue;
        }
        if(/^\s*\|/.test(line) && i+1<lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
          const cells=row=>row.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
          const headers=cells(line);
          i+=2;
          const rows=[];
          while(i<lines.length && /^\s*\|/.test(lines[i])){ rows.push(cells(lines[i])); i++; }
          blocks.push({type:'table', headers, rows});
          continue;
        }
        const heading=/^(#{1,6})\s+(.*)$/.exec(line);
        if(heading){ blocks.push({type:'h', level:heading[1].length, text:heading[2].trim()}); i++; continue; }
        if(/^(\s*)[-*]\s+/.test(line)){
          const items=[];
          while(i<lines.length){
            const item=/^(\s*)[-*]\s+(.*)$/.exec(lines[i]);
            if(!item) break;
            items.push({depth:Math.floor(item[1].replace(/\t/g,'  ').length/2), text:item[2].trim()});
            i++;
          }
          blocks.push({type:'ul', items});
          continue;
        }
        if(!line.trim()){ i++; continue; }
        const buf=[line.trim()];
        i++;
        while(i<lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^(\s*)[-*]\s+/.test(lines[i]) && !/^\s*```/.test(lines[i]) && !/^\s*\|/.test(lines[i])){
          buf.push(lines[i].trim()); i++;
        }
        blocks.push({type:'p', text:buf.join(' ')});
      }
      return blocks;
    },
    markdownInlineHtml(text){
      const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      return String(text||'').split(/(`[^`]+`)/g).map(part=>{
        if(part.length>=2 && part.startsWith('`') && part.endsWith('`')) return '<code>'+esc(part.slice(1,-1))+'</code>';
        return esc(part).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
      }).join('');
    },
    markdownListHtml(items){
      if(!items.length) return '';
      const base=items[0].depth;
      let html='<ul>', i=0;
      while(i<items.length){
        if(items[i].depth<base) break;
        const text=items[i].text;
        i++;
        const children=[];
        while(i<items.length && items[i].depth>base){ children.push(items[i]); i++; }
        html+='<li>'+this.markdownInlineHtml(text)+this.markdownListHtml(children)+'</li>';
      }
      return html+'</ul>';
    },
    additionalMarkdownHtml(src){
      const blocks=this.additionalMarkdownBlocks(src);
      if(!blocks.length) return '';
      const body=blocks.map(block=>{
        if(block.type==='h') return '<h'+Math.min(block.level+1,4)+'>'+this.markdownInlineHtml(block.text)+'</h'+Math.min(block.level+1,4)+'>';
        if(block.type==='p') return '<p>'+this.markdownInlineHtml(block.text)+'</p>';
        if(block.type==='ul') return this.markdownListHtml(block.items);
        if(block.type==='code') return '<pre>'+String(block.text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))+'</pre>';
        const head='<tr>'+block.headers.map(cell=>'<th>'+this.markdownInlineHtml(cell)+'</th>').join('')+'</tr>';
        const rows=block.rows.map(row=>'<tr>'+block.headers.map((_,col)=>'<td>'+this.markdownInlineHtml(row[col]||'')+'</td>').join('')+'</tr>').join('');
        return '<table class="md"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>';
      }).join('');
      return '<section class="extra">'+body+'</section>';
    },
    plainMarkdown(text){ return String(text||'').replace(/`([^`]+)`/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1'); },
  });
})();
