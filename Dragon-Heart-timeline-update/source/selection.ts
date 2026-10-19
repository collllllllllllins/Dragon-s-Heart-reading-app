/** Select a complete sentence without assuming text lives in a single node. */
export function selectSentenceAtPoint(root:HTMLElement,x:number,y:number):boolean{
 const doc=root.ownerDocument;
 const caretDoc=doc as Document & {caretPositionFromPoint?:(x:number,y:number)=>{offsetNode:Node;offset:number}|null;caretRangeFromPoint?:(x:number,y:number)=>Range|null};
 const caret=caretDoc.caretPositionFromPoint?.(x,y);
 const point=caret?doc.createRange():caretDoc.caretRangeFromPoint?.(x,y);
 if(!point)return false;
 if(caret){point.setStart(caret.offsetNode,caret.offset);point.collapse(true);}
 if(!root.contains(point.startContainer))return false;
 const parent=point.startContainer.nodeType===Node.ELEMENT_NODE?point.startContainer as Element:point.startContainer.parentElement;
 const candidate=parent?.closest('p,li,h1,h2,h3,blockquote,div');
 const block=candidate&&root.contains(candidate)?candidate:root;
 const text=block.textContent||'';
 if(!text.trim())return false;
 const prefix=doc.createRange();prefix.selectNodeContents(block);prefix.setEnd(point.startContainer,point.startOffset);
 const offset=Math.min(prefix.toString().length,text.length-1);
 let start=0,end=text.length;
 // Intl handles Chinese punctuation, closing quotes, and English abbreviations.
 if(typeof Intl.Segmenter==='function'){
  for(const segment of new Intl.Segmenter('zh',{granularity:'sentence'}).segment(text)){
   if(offset>=segment.index&&offset<segment.index+segment.segment.length){start=segment.index;end=start+segment.segment.length;break;}
  }
 }else{
  for(const match of text.matchAll(/[^。！？!?\n]+[。！？!?]?[”’」』\"]*|\n/g)){
   const index=match.index!;if(offset>=index&&offset<index+match[0].length){start=index;end=index+match[0].length;break;}
  }
 }
 while(start<end&&/\s/.test(text[start]))start++;
 while(end>start&&/\s/.test(text[end-1]))end--;
 if(start===end||end-start>3000)return false;
 const walker=doc.createTreeWalker(block,NodeFilter.SHOW_TEXT),range=doc.createRange();
 let node:Node|null,total=0,foundStart=false;
 while((node=walker.nextNode())){
  const length=node.textContent?.length||0;
  if(!foundStart&&start<total+length){range.setStart(node,start-total);foundStart=true;}
  if(foundStart&&end<=total+length){range.setEnd(node,end-total);const selection=doc.defaultView?.getSelection();if(!selection)return false;selection.removeAllRanges();selection.addRange(range);return true;}
  total+=length;
 }
 return false;
}
