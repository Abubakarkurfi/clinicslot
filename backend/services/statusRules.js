// Which status changes are allowed, by whom and when. Pure functions: no database here.

// from-status  ->  statuses it may move to
const ALLOWED = {
  Booked:    ['CheckedIn', 'NoShow', 'Cancelled'],
  CheckedIn: ['Completed'],
  Completed: [],
  Cancelled: [],
  NoShow:    []
};

const STATUSES = Object.keys(ALLOWED);

// Which roles may set each target status
function roleCanSet(role, newStatus) {
  if (role === 'Receptionist') return true;
  if (role === 'Admin' || role === 'Patient') return newStatus === 'Cancelled';
  return false;
}

// appt has: status, isToday (bool), minutesUntilStart (number, negative = already started)
// Returns null when the change is allowed, otherwise a message for 409 INVALID_STATUS_CHANGE.
function checkStatusChange(appt, newStatus, role) {
  if (!ALLOWED[appt.status].includes(newStatus)) {
    return `An appointment that is ${appt.status} cannot be changed to ${newStatus}.`;
  }
  if ((newStatus === 'CheckedIn' || newStatus === 'NoShow') && !appt.isToday) {
    return "Only today's appointments can be checked in or marked as no-show.";
  }
  if (newStatus === 'NoShow' && appt.minutesUntilStart > 0) {
    return 'A patient can only be marked as no-show after the start time.';
  }
  if (newStatus === 'Cancelled' && appt.minutesUntilStart <= 0) {
    return 'This appointment has already started and can no longer be cancelled.';
  }
  if (newStatus === 'Cancelled' && role === 'Patient' && appt.minutesUntilStart < 120) {
    return 'Patients can cancel only up to 2 hours before the start time. Please call the clinic.';
  }
  return null;
}

module.exports = { STATUSES, roleCanSet, checkStatusChange };
