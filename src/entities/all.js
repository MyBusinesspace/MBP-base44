/**
 * Entity accessors — same import path as before (@/entities/all).
 * Backed by the local API + PostgreSQL.
 */
import { api } from '@/api/client';

function entityExport(name) {
  const handler = api.entities[name];
  if (name === 'User') {
    return new Proxy(handler, {
      get(target, prop) {
        if (prop === 'me') return api.auth.me;
        if (prop === 'loginWithRedirect' || prop === 'login') return api.auth.loginWithRedirect;
        if (prop === 'logout') return api.auth.logout;
        if (prop === 'updateMyUserData') return api.auth.updateMe;
        return target[prop];
      },
    });
  }
  return handler;
}

const ENTITY_NAMES = [
  'AppSettings', 'Asset', 'AssetCategory', 'AssetCustomField', 'AssetDocument',
  'AssetDocumentFolder', 'AssetDocumentType', 'AssetMaintenance', 'AssetStatus',
  'AssetSubcategory', 'Branch', 'CalendarEvent', 'CalendarEventCategory',
  'CalendarEventInvitation', 'Chat', 'ClientEquipment', 'CompanyDocument', 'Contact',
  'ContactCategory', 'Customer', 'CustomerCategory', 'CustomerDocument', 'Department',
  'DocumentFolder', 'DocumentType', 'EmployeeDocument', 'EmployeeDocumentType',
  'EmployeeNumberConfig', 'EmployeePayrollProfile', 'FinanceCategory', 'FormSubmission',
  'FormFlowConfig', 'FormTemplate', 'FormDepartment', 'LeaveRequest', 'Message',
  'NavigationConfig', 'OrganizationChartConfig', 'PayItem', 'PayItemType', 'PayrollRun',
  'PayStub', 'PettyCashCategory', 'PettyCashEntry', 'Project', 'ProjectCategory',
  'ProjectDocument', 'ProjectDocumentFolder', 'ProjectDocumentType', 'PublicHoliday',
  'QuickReportSettings', 'QuickTask', 'QuickTaskCategory', 'QuickTaskComment',
  'QuickTaskSettings', 'ShiftType', 'Team', 'TimeEntry', 'TimeReport', 'TimesheetEntry',
  'TimesheetsSettings', 'User', 'UserActivityLog', 'UserInvitation', 'UserStatus',
  'WallPost', 'WorkingOrder', 'WorkingReport', 'WorkingReportCounter', 'WorkOrderCategory',
  'WorkOrderCounter', 'WorkOrderDraft',
];

const exported = {};
for (const name of ENTITY_NAMES) {
  exported[name] = entityExport(name);
}

export default exported;
export const {
  AppSettings, Asset, AssetCategory, AssetCustomField, AssetDocument, AssetDocumentFolder,
  AssetDocumentType, AssetMaintenance, AssetStatus, AssetSubcategory, Branch, CalendarEvent,
  CalendarEventCategory, CalendarEventInvitation, Chat, ClientEquipment, CompanyDocument,
  Contact, ContactCategory, Customer, CustomerCategory, CustomerDocument, Department,
  DocumentFolder, DocumentType, EmployeeDocument, EmployeeDocumentType, EmployeeNumberConfig,
  EmployeePayrollProfile, FinanceCategory, FormSubmission, FormFlowConfig, FormTemplate,
  FormDepartment, LeaveRequest, Message, NavigationConfig, OrganizationChartConfig, PayItem,
  PayItemType, PayrollRun, PayStub, PettyCashCategory, PettyCashEntry, Project, ProjectCategory,
  ProjectDocument, ProjectDocumentFolder, ProjectDocumentType, PublicHoliday, QuickReportSettings,
  QuickTask, QuickTaskCategory, QuickTaskComment, QuickTaskSettings, ShiftType, Team, TimeEntry,
  TimeReport, TimesheetEntry, TimesheetsSettings, User, UserActivityLog, UserInvitation,
  UserStatus, WallPost, WorkingOrder, WorkingReport, WorkingReportCounter, WorkOrderCategory,
  WorkOrderCounter, WorkOrderDraft,
} = exported;
