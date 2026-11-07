(function(root){
const holidays = {
  2026: ['01-01','01-19','02-16','04-03','05-25','06-19','07-03','09-07','11-26','12-25'],
  2027: ['01-01','01-18','02-15','03-26','05-31','06-18','07-05','09-06','11-25','12-24'],
  2028: ['01-17','02-21','04-14','05-29','06-19','07-04','09-04','11-23','12-25']
};
const early = new Set(['2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24']);
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23', weekday:'short' });
function marketStatus(now = new Date()) {
  const p = Object.fromEntries(formatter.formatToParts(now).map(x => [x.type,x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const minutes = +p.hour * 60 + +p.minute;
  const close = early.has(date) ? 13 * 60 : 16 * 60;
  const known = !!holidays[p.year];
  const dayOff = ['Sat','Sun'].includes(p.weekday) || holidays[p.year]?.includes(`${p.month}-${p.day}`);
  const isOpen = known && !dayOff && minutes >= 570 && minutes < close;
  let label = isOpen ? '正常交易时段' : !known ? '交易日历待更新' : dayOff ? '休市' : minutes < 570 ? '尚未开盘' : '已收盘';
  return {isOpen, label, date, newYorkTime:`${p.hour}:${p.minute}:${p.second}`, closeTime:close === 780 ? '13:00' : '16:00', earlyClose:early.has(date), calendarThrough:2028, source:'https://www.nyse.com/trade/hours-calendars'};
}
root.EquityCalendar={marketStatus};

})(globalThis);