// Se ejecuta una vez en el proceso padre; los workers de Jest heredan el entorno.
module.exports = async () => {
  process.env.TZ = 'Europe/Madrid';
};
