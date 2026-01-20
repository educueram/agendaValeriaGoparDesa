const moment = require('moment-timezone');
const config = require('../config');
const { getSheetsInstance } = require('./googleAuth');
const { sendReminder24h, sendReminder12h, sendReminder15min } = require('./emailService');

/**
 * Servicio de Recordatorios Automáticos
 * Envía notificaciones de citas próximas por email y WhatsApp
 */

/**
 * Obtener citas próximas en las siguientes 24 horas
 */
async function getUpcomingAppointments24h() {
  try {
    console.log('🔍 === BUSCANDO CITAS PRÓXIMAS (24 HORAS) ===');
    
    const sheets = await getSheetsInstance();
    const now = moment().tz(config.timezone.default);
    const in23Hours = now.clone().add(23, 'hours');
    const in25Hours = now.clone().add(25, 'hours');
    
    console.log(`⏰ Ahora: ${now.format('YYYY-MM-DD HH:mm')}`);
    console.log(`⏰ Ventana de recordatorio: ${in23Hours.format('YYYY-MM-DD HH:mm')} a ${in25Hours.format('YYYY-MM-DD HH:mm')}`);
    
    // Obtener todos los datos de la hoja CLIENTES
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: config.sheets.clients
    });

    const data = response.data.values || [];
    
    if (data.length <= 1) {
      console.log('⚠️ No hay datos en la hoja CLIENTES');
      return [];
    }

    const upcomingAppointments = [];
    
    // Buscar citas próximas (excluir header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const estado = row[9]; // ESTADO
      const fechaCita = row[6]; // FECHA_CITA
      const horaCita = row[7]; // HORA_CITA
      
      console.log(`🔍 Revisando fila ${i}: ${row[2]} - Fecha: ${fechaCita} Hora: ${horaCita} Estado: ${estado}`);
      
      // Solo enviar recordatorio de 24h si el estado es AGENDADA o REAGENDADA
      if (estado !== 'AGENDADA' && estado !== 'REAGENDADA') {
        console.log(`   ⏭️ Saltando: estado "${estado}" no válido para recordatorio 24h (solo AGENDADA o REAGENDADA)`);
        continue;
      }
      
      console.log(`   ✅ Estado válido para recordatorio: ${estado}`);
      
      // Verificar que tenga fecha y hora
      if (!fechaCita || !horaCita) {
        console.log(`   ⏭️ Saltando: falta fecha u hora`);
        continue;
      }
      
      // Crear momento de la cita
      const appointmentTime = moment.tz(`${fechaCita} ${horaCita}`, 'YYYY-MM-DD HH:mm', config.timezone.default);
      
      if (!appointmentTime.isValid()) {
        console.log(`   ⚠️ Fecha/hora inválida: ${fechaCita} ${horaCita}`);
        continue;
      }
      
      const hoursUntil = appointmentTime.diff(now, 'hours', true);
      console.log(`   ⏱️ Horas hasta la cita: ${hoursUntil.toFixed(2)}`);
      
      // Verificar si está entre 23 y 25 horas en el futuro (ventana de 24h)
      if (hoursUntil >= 23 && hoursUntil <= 25) {
        upcomingAppointments.push({
          codigoReserva: row[1],
          clientName: row[2],
          clientPhone: row[3],
          clientEmail: row[4],
          profesionalName: row[5],
          fechaCita: row[6],
          horaCita: row[7],
          serviceName: row[8],
          estado: row[9],
          appointmentTime: appointmentTime,
          hoursUntil: Math.round(hoursUntil)
        });
        
        console.log(`✅ ¡CITA ENCONTRADA! ${row[2]} - ${fechaCita} ${horaCita} (en ${hoursUntil.toFixed(1)} horas)`);
      } else if (hoursUntil > 0 && hoursUntil < 23) {
        console.log(`   ⏭️ Cita muy próxima (${hoursUntil.toFixed(1)}h) - recordatorio ya debió enviarse o se enviará el de 15min`);
      } else if (hoursUntil > 25) {
        console.log(`   ⏭️ Cita lejana (${hoursUntil.toFixed(1)}h) - aún no es tiempo de recordatorio de 24h`);
      } else {
        console.log(`   ⏭️ Cita en el pasado`);
      }
    }

    console.log(`\n📊 Total citas próximas (24h): ${upcomingAppointments.length}`);
    return upcomingAppointments;

  } catch (error) {
    console.error('❌ Error obteniendo citas próximas (24h):', error.message);
    return [];
  }
}

/**
 * Obtener citas próximas en las siguientes 12 horas
 */
async function getUpcomingAppointments12h() {
  try {
    console.log('🔍 === BUSCANDO CITAS PRÓXIMAS (12 HORAS) ===');
    
    const sheets = await getSheetsInstance();
    const now = moment().tz(config.timezone.default);
    const in11Hours = now.clone().add(11, 'hours');
    const in13Hours = now.clone().add(13, 'hours');
    
    console.log(`⏰ Ahora: ${now.format('YYYY-MM-DD HH:mm')}`);
    console.log(`⏰ Ventana de recordatorio: ${in11Hours.format('YYYY-MM-DD HH:mm')} a ${in13Hours.format('YYYY-MM-DD HH:mm')}`);
    
    // Obtener todos los datos de la hoja CLIENTES
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: config.sheets.clients
    });

    const data = response.data.values || [];
    
    if (data.length <= 1) {
      console.log('⚠️ No hay datos en la hoja CLIENTES');
      return [];
    }

    const upcomingAppointments = [];
    
    // Buscar citas próximas (excluir header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const estado = row[9]; // ESTADO
      const fechaCita = row[6]; // FECHA_CITA
      const horaCita = row[7]; // HORA_CITA
      
      console.log(`🔍 Revisando fila ${i}: ${row[2]} - Fecha: ${fechaCita} Hora: ${horaCita} Estado: ${estado}`);
      
      // Excluir solo citas canceladas - todas las demás reciben recordatorio de 12h (incluso confirmadas)
      if (estado === 'CANCELADA') {
        console.log(`   ⏭️ Saltando: cita CANCELADA - no se envía recordatorio`);
        continue;
      }
      
      console.log(`   ✅ Estado válido para recordatorio 12h: ${estado} (se envía siempre como recordatorio)`);
      
      // Verificar que tenga fecha y hora
      if (!fechaCita || !horaCita) {
        console.log(`   ⏭️ Saltando: falta fecha u hora`);
        continue;
      }
      
      // Crear momento de la cita
      const appointmentTime = moment.tz(`${fechaCita} ${horaCita}`, 'YYYY-MM-DD HH:mm', config.timezone.default);
      
      if (!appointmentTime.isValid()) {
        console.log(`   ⚠️ Fecha/hora inválida: ${fechaCita} ${horaCita}`);
        continue;
      }
      
      const hoursUntil = appointmentTime.diff(now, 'hours', true);
      console.log(`   ⏱️ Horas hasta la cita: ${hoursUntil.toFixed(2)}`);
      
      // Verificar si está entre 11 y 13 horas en el futuro (ventana de 12h)
      if (hoursUntil >= 11 && hoursUntil <= 13) {
        upcomingAppointments.push({
          codigoReserva: row[1],
          clientName: row[2],
          clientPhone: row[3],
          clientEmail: row[4],
          profesionalName: row[5],
          fechaCita: row[6],
          horaCita: row[7],
          serviceName: row[8],
          estado: row[9],
          appointmentTime: appointmentTime,
          hoursUntil: Math.round(hoursUntil)
        });
        
        console.log(`✅ ¡CITA ENCONTRADA! ${row[2]} - ${fechaCita} ${horaCita} (en ${hoursUntil.toFixed(1)} horas)`);
      } else if (hoursUntil > 0 && hoursUntil < 11) {
        console.log(`   ⏭️ Cita muy próxima (${hoursUntil.toFixed(1)}h) - recordatorio ya debió enviarse o se enviará el de 15min`);
      } else if (hoursUntil > 13) {
        console.log(`   ⏭️ Cita lejana (${hoursUntil.toFixed(1)}h) - aún no es tiempo de recordatorio de 12h`);
      } else {
        console.log(`   ⏭️ Cita en el pasado`);
      }
    }

    console.log(`\n📊 Total citas próximas (12h): ${upcomingAppointments.length}`);
    return upcomingAppointments;

  } catch (error) {
    console.error('❌ Error obteniendo citas próximas (12h):', error.message);
    return [];
  }
}

/**
 * Obtener citas próximas en los siguientes 15 minutos
 */
async function getUpcomingAppointments15min() {
  try {
    console.log('🔍 === BUSCANDO CITAS PRÓXIMAS (15 MINUTOS) ===');
    
    const sheets = await getSheetsInstance();
    const now = moment().tz(config.timezone.default);
    const in20Minutes = now.clone().add(20, 'minutes'); // Ventana de 20 min para cubrir mejor
    
    console.log(`⏰ Ahora: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`⏰ Ventana hasta: ${in20Minutes.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // Obtener todos los datos de la hoja CLIENTES
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: config.sheets.clients
    });

    const data = response.data.values || [];
    
    if (data.length <= 1) {
      console.log('⚠️ No hay datos en la hoja CLIENTES');
      return [];
    }

    const upcomingAppointments = [];
    
    // Buscar citas próximas (excluir header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const estado = row[9]; // ESTADO
      const fechaCita = row[6]; // FECHA_CITA
      const horaCita = row[7]; // HORA_CITA
      
      console.log(`🔍 Revisando fila ${i}: ${row[2]} - Fecha: ${fechaCita} Hora: ${horaCita} Estado: ${estado}`);
      
      // Excluir solo citas canceladas - todas las demás reciben recordatorio de 15min (incluso confirmadas)
      if (estado === 'CANCELADA') {
        console.log(`   ⏭️ Saltando: cita CANCELADA - no se envía recordatorio`);
        continue;
      }
      
      console.log(`   ✅ Estado válido para recordatorio 15min: ${estado} (se envía siempre como recordatorio)`);
      
      // Verificar que tenga fecha y hora
      if (!fechaCita || !horaCita) {
        console.log(`   ⏭️ Saltando: falta fecha u hora`);
        continue;
      }
      
      // Crear momento de la cita
      const appointmentTime = moment.tz(`${fechaCita} ${horaCita}`, 'YYYY-MM-DD HH:mm', config.timezone.default);
      
      if (!appointmentTime.isValid()) {
        console.log(`   ⚠️ Fecha/hora inválida: ${fechaCita} ${horaCita}`);
        continue;
      }
      
      const minutesUntil = appointmentTime.diff(now, 'minutes', true);
      console.log(`   ⏱️ Minutos hasta la cita: ${minutesUntil.toFixed(2)}`);
      
      // Verificar si está en los próximos 10-20 minutos (ventana de recordatorio)
      // Usamos >= 10 para evitar enviar múltiples recordatorios
      if (minutesUntil >= 10 && minutesUntil <= 20) {
        upcomingAppointments.push({
          codigoReserva: row[1],
          clientName: row[2],
          clientPhone: row[3],
          clientEmail: row[4],
          profesionalName: row[5],
          fechaCita: row[6],
          horaCita: row[7],
          serviceName: row[8],
          estado: row[9],
          appointmentTime: appointmentTime,
          minutesUntil: Math.round(minutesUntil)
        });
        
        console.log(`✅ ¡CITA ENCONTRADA! ${row[2]} - ${fechaCita} ${horaCita} (en ${Math.round(minutesUntil)} minutos)`);
      } else if (minutesUntil > 0 && minutesUntil < 10) {
        console.log(`   ⏭️ Cita muy próxima (${Math.round(minutesUntil)}min) - ya se debió enviar recordatorio`);
      } else if (minutesUntil > 20) {
        console.log(`   ⏭️ Cita lejana (${Math.round(minutesUntil)}min) - aún no es tiempo de recordatorio`);
      } else {
        console.log(`   ⏭️ Cita en el pasado o justo ahora`);
      }
    }

    console.log(`\n📊 Total citas próximas (15min): ${upcomingAppointments.length}`);
    return upcomingAppointments;

  } catch (error) {
    console.error('❌ Error obteniendo citas próximas (15min):', error.message);
    console.error('Stack:', error.stack);
    return [];
  }
}

/**
 * Enviar recordatorio por email (24 horas antes)
 */
async function sendEmailReminder24h(appointment) {
  try {
    console.log(`📧 Enviando recordatorio 24h a: ${appointment.clientEmail}`);
    
    const result = await sendReminder24h(appointment);
    
    if (result.success) {
      console.log(`✅ Email de recordatorio 24h enviado exitosamente a: ${appointment.clientEmail}`);
      return true;
    } else {
      console.log(`⚠️ No se pudo enviar recordatorio 24h: ${result.reason || result.error}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error enviando email 24h:`, error.message);
    return false;
  }
}

/**
 * Enviar recordatorio por email (12 horas antes)
 */
async function sendEmailReminder12h(appointment) {
  try {
    console.log(`📧 Enviando recordatorio 12h a: ${appointment.clientEmail}`);
    
    const result = await sendReminder12h(appointment);
    
    if (result.success) {
      console.log(`✅ Email de recordatorio 12h enviado exitosamente a: ${appointment.clientEmail}`);
      return true;
    } else {
      console.log(`⚠️ No se pudo enviar recordatorio 12h: ${result.reason || result.error}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error enviando email 12h:`, error.message);
    return false;
  }
}

/**
 * Enviar recordatorio por email (15 minutos antes)
 */
async function sendEmailReminder15min(appointment) {
  try {
    console.log(`📧 Enviando recordatorio 15min a: ${appointment.clientEmail}`);
    
    const result = await sendReminder15min(appointment);
    
    if (result.success) {
      console.log(`✅ Email de recordatorio 15min enviado exitosamente a: ${appointment.clientEmail}`);
      return true;
    } else {
      console.log(`⚠️ No se pudo enviar recordatorio 15min: ${result.reason || result.error}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error enviando email 15min:`, error.message);
    return false;
  }
}

/**
 * Formatear hora a formato 12 horas
 */
function formatTimeTo12Hour(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return timeString;
  }
  
  const parts = timeString.split(':');
  if (parts.length < 2) {
    return timeString;
  }
  
  const hour24 = parseInt(parts[0]);
  const minutes = parts[1];
  
  if (isNaN(hour24)) {
    return timeString;
  }
  
  if (hour24 === 0) {
    return `12:${minutes} AM`;
  } else if (hour24 < 12) {
    return `${hour24}:${minutes} AM`;
  } else if (hour24 === 12) {
    return `12:${minutes} PM`;
  } else {
    return `${hour24 - 12}:${minutes} PM`;
  }
}

/**
 * Generar mensaje de WhatsApp para recordatorio de 24h
 */
function generateWhatsAppMessage24h(appointment) {
  const fechaFormateada = moment.tz(appointment.fechaCita, config.timezone.default).format('dddd, D [de] MMMM [de] YYYY');
  const horaFormateada = formatTimeTo12Hour(appointment.horaCita);
  
  return `🔔 *Recordatorio de Cita*

Hola *${appointment.clientName}*,

Te recordamos que tienes una cita programada para *mañana*:

📅 *Fecha:* ${fechaFormateada}
⏰ *Hora:* ${horaFormateada}
👨‍⚕️ *Con:* ${appointment.profesionalName}
🩺 *Servicio:* ${appointment.serviceName}
🎟️ *Código:* ${appointment.codigoReserva}

⚠️ *¿Deseas confirmar tu asistencia?*

Responde con:
• 1️⃣ *CONFIRMAR* - Para confirmar tu asistencia
• 2️⃣ *REAGENDAR* - Si necesitas cambiar la fecha/hora

📍 ${config.business.address}

¡Te esperamos! 🌟`;
}

/**
 * Generar mensaje de WhatsApp para recordatorio de 12h
 */
function generateWhatsAppMessage12h(appointment) {
  const fechaFormateada = moment.tz(appointment.fechaCita, config.timezone.default).format('dddd, D [de] MMMM [de] YYYY');
  const horaFormateada = formatTimeTo12Hour(appointment.horaCita);
  const isConfirmed = appointment.estado === 'CONFIRMADA';
  const confirmationSection = isConfirmed ? 
    `✅ *Tu cita está confirmada*` :
    `⚠️ *¿Deseas confirmar tu asistencia?*

Responde con:
• 1️⃣ *CONFIRMAR* - Para confirmar tu asistencia
• 2️⃣ *REAGENDAR* - Si necesitas cambiar la fecha/hora`;
  
  return `🔔 *Recordatorio de Cita*

Hola *${appointment.clientName}*,

Te recordamos que tienes una cita programada para *hoy*:

📅 *Fecha:* ${fechaFormateada}
⏰ *Hora:* ${horaFormateada}
👨‍⚕️ *Con:* ${appointment.profesionalName}
🩺 *Servicio:* ${appointment.serviceName}
🎟️ *Código:* ${appointment.codigoReserva}

${confirmationSection}

📍 ${config.business.address}

¡Te esperamos! 🌟`;
}

/**
 * Generar mensaje de WhatsApp para recordatorio de 15min
 */
function generateWhatsAppMessage15min(appointment) {
  const horaFormateada = formatTimeTo12Hour(appointment.horaCita);
  const isConfirmed = appointment.estado === 'CONFIRMADA';
  const confirmationSection = isConfirmed ? 
    `✅ *Tu cita está confirmada*` :
    `⚠️ *¡IMPORTANTE! Tu cita aún no está confirmada*

Responde con:
• 1️⃣ *CONFIRMAR* - Para confirmar tu asistencia ahora`;
  
  return `⏰ *¡Tu cita es en 15 minutos!*

Hola *${appointment.clientName}*,

Tu cita es en *15 minutos*:

⏰ *Hora:* ${horaFormateada}
👨‍⚕️ *Con:* ${appointment.profesionalName}
🎟️ *Código:* ${appointment.codigoReserva}

${confirmationSection}

📍 *Dirección:* ${config.business.address}

¡Te esperamos! 🌟`;
}

module.exports = {
  getUpcomingAppointments24h,
  getUpcomingAppointments12h,
  getUpcomingAppointments15min,
  sendEmailReminder24h,
  sendEmailReminder12h,
  sendEmailReminder15min,
  generateWhatsAppMessage24h,
  generateWhatsAppMessage12h,
  generateWhatsAppMessage15min
};

