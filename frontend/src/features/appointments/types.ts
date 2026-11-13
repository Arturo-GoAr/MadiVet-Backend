export type AppointmentType = "medical" | "grooming" | "vaccination";

export type Appointment = {
  id: string;
  type: AppointmentType;
  pet: string | null;
  date: string;
  subject: string;
};
