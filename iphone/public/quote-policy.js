(function(root,factory){
  const policy=factory();
  if(typeof module==='object'&&module.exports)module.exports=policy;
  else root.EquityQuotePolicy=policy;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function quoteBlock(quote,now,symbol){
    if(!quote)return '暂无有效报价，请刷新行情后重试。';
    if(quote.symbol!==symbol)return '报价标的与订单不一致，请刷新行情。';
    if(typeof quote.price!=='number'||!Number.isFinite(quote.price)||quote.price<=0)return '报价无效，暂不能成交。';
    const age=Number(now)-Date.parse(quote.fetchedAt);
    if(!Number.isFinite(age)||age< -2000||age>60000)return '报价读取已超过 60 秒，请刷新行情后重试。';
    if(['halted','suspended'].includes(quote.tradingStatus))return '来源显示标的暂停交易，暂不能成交。';
    return '';
  }
  return {quoteBlock};
});
