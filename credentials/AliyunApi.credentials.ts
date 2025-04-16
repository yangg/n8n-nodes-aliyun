import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AliyunApi implements ICredentialType {
	name = 'aliyunApi';
	displayName = 'Aliyun API';
	documentationUrl = 'https://help.aliyun.com/document_detail/378664.html';
	properties: INodeProperties[] = [
		{
			displayName: 'Region',
			name: 'region',
			type: 'string',
			default: 'cn-shenzhen',
			required: true,
		},
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Access Key Secret',
			name: 'accessKeySecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];
}
