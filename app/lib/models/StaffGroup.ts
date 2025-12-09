import { ObjectId } from "mongodb";
import { GratuityDistributionType } from "../../../types";

export interface GratuityConfigDocument {
  distributesGratuities: boolean;
  contributionSource?: 'sales' | 'gratuities'; // For distributor groups
  sourceGroupIds?: ObjectId[];
  distributionType?: GratuityDistributionType;
  distributionBasis?: 'sales' | 'gratuities';
  fixedAmount?: number;
  percentage?: number;
  recipientGroupIds?: ObjectId[];
  tipPoolId?: string;
}

export interface GratuityConfig {
  distributesGratuities: boolean;
  contributionSource?: 'sales' | 'gratuities'; 
  distributionBasis?: 'sales' | 'gratuities';  
  
  sourceGroupIds?: ObjectId[];
  recipientGroupIds?: ObjectId[];
  distributionType?: 'fixed' | 'percentage';
  fixedAmount?: number;
  percentage?: number;
  tipPoolId?: string;  // Groups with same tipPoolId share the percentage

}
export interface StaffGroupDocument {
  _id?: ObjectId;
  name: string;
  description?: string;
  staffMemberIds: ObjectId[];
  dateCreated: Date;
  dateUpdated: Date;
  gratuityConfig: GratuityConfigDocument;
}

export interface StaffGroupWithId {
  id: string;
  name: string;
  description?: string;
  staffMemberIds: string[];
  dateCreated: Date;
  dateUpdated: Date;
  gratuityConfig: {
    distributesGratuities: boolean;
    contributionSource?: 'sales' | 'gratuities'; 
    distributionBasis?: 'sales' | 'gratuities';
    sourceGroupIds?: string[];
    recipientGroupIds?: string[];
    distributionType?: GratuityDistributionType;
    fixedAmount?: number;
    percentage?: number;
    tipPoolId?: string;
  };
}

export function transformStaffGroup(doc: StaffGroupDocument): StaffGroupWithId {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    description: doc.description,
    staffMemberIds: doc.staffMemberIds.map(id => id.toString()),
    dateCreated: doc.dateCreated,
    dateUpdated: doc.dateUpdated,
    gratuityConfig: {
      distributesGratuities: doc.gratuityConfig.distributesGratuities,
      contributionSource: doc.gratuityConfig.contributionSource, 
      distributionBasis: doc.gratuityConfig.distributionBasis,
      sourceGroupIds: doc.gratuityConfig.sourceGroupIds?.map(id => id.toString()) || [],
      distributionType: doc.gratuityConfig.distributionType,
      fixedAmount: doc.gratuityConfig.fixedAmount,
      percentage: doc.gratuityConfig.percentage,
      recipientGroupIds: doc.gratuityConfig.recipientGroupIds?.map(id => id.toString()) || [],
      tipPoolId: doc.gratuityConfig.tipPoolId
    }
  };
}

export function toStaffGroupDocument(
  data: Partial<StaffGroupWithId>
): Partial<StaffGroupDocument> {
  const doc: Partial<StaffGroupDocument> = {};
  
  if (data.name !== undefined) doc.name = data.name;
  if (data.description !== undefined) doc.description = data.description;
  if (data.staffMemberIds !== undefined) {
    doc.staffMemberIds = data.staffMemberIds.map(id => new ObjectId(id));
  }
  if (data.dateCreated !== undefined) doc.dateCreated = data.dateCreated;
  if (data.dateUpdated !== undefined) doc.dateUpdated = data.dateUpdated;
  
  if (data.gratuityConfig !== undefined) {
    doc.gratuityConfig = {
      distributesGratuities: data.gratuityConfig.distributesGratuities,
      contributionSource: data.gratuityConfig.contributionSource,
      distributionBasis: data.gratuityConfig.distributionBasis,
      sourceGroupIds: data.gratuityConfig.sourceGroupIds?.map(id => new ObjectId(id)) || [],
      distributionType: data.gratuityConfig.distributionType,
      fixedAmount: data.gratuityConfig.fixedAmount,
      percentage: data.gratuityConfig.percentage,
      recipientGroupIds: data.gratuityConfig.recipientGroupIds?.map(id => new ObjectId(id)) || [],
      tipPoolId: data.gratuityConfig.tipPoolId
    };
  }
  
  return doc;
}