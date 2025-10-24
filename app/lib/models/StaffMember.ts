import { ObjectId } from 'bson';

export interface StaffMemberDocument {
  _id?: ObjectId;
  firstName: string;
  lastName: string;
  dateCreated: Date;
  collectsSales: boolean;
}

export interface StaffMemberWithId {
  id: string;
  firstName: string;
  lastName: string;
  dateCreated: Date;
  collectsSales: boolean;
}

// Transform MongoDB document to frontend format
export function transformStaffMember(doc: StaffMemberDocument): StaffMemberWithId {
  return {
    id: doc._id!.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    dateCreated: doc.dateCreated,
    collectsSales: doc.collectsSales,
  };
}

// Transform frontend format to MongoDB document (for updates)
export function toStaffMemberDocument(
  data: Partial<StaffMemberWithId>
): Partial<StaffMemberDocument> {
  const doc: Partial<StaffMemberDocument> = {};
  
  if (data.firstName !== undefined) doc.firstName = data.firstName;
  if (data.lastName !== undefined) doc.lastName = data.lastName;
  if (data.dateCreated !== undefined) doc.dateCreated = data.dateCreated;
  if (data.collectsSales !== undefined) doc.collectsSales = data.collectsSales;
  
  return doc;
}