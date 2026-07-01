function goStripe(link, email){
  if(!link||link.startsWith("REPLACE")){ alert("Stripe not connected yet — add your Payment Links to the PLANS config."); return; }
  const url = email ? link+"?prefilled_email="+encodeURIComponent(email) : link;
  window.location.href = url;
}

export { goStripe };
