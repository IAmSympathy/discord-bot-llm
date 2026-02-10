// Test de la fonction getCurrentDate avec timezone
function getCurrentDate() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montreal',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';

    return `${year}-${month}-${day}`;
}

console.log('Date locale:', new Date().toLocaleDateString());
console.log('Date UTC:', new Date().toISOString().split('T')[0]);
console.log('Date Montreal:', getCurrentDate());

