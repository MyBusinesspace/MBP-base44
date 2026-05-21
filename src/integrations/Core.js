import { api } from '@/api/client';

const core = api.integrations.Core;

export const UploadFile = (params) => core.UploadFile(params);
export const UploadPrivateFile = (params) => core.UploadPrivateFile(params);
export const CreateFileSignedUrl = (params) => core.CreateFileSignedUrl(params);
export const ExtractDataFromUploadedFile = (params) => core.ExtractDataFromUploadedFile(params);
