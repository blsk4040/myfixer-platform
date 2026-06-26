export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  role: UserRole;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  role: UserRole;
  phoneNumber: string;
  firstName: string;
  lastName: string;
}

export interface UserRow {
  id: string;
  role: UserRole;
  phone_number: string;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
}
