import {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';
import { createHmac, createHash, randomBytes } from 'crypto';

export class AliyunApi implements ICredentialType {
	name = 'aliyunApi';
	displayName = 'Aliyun API';
	documentationUrl = 'https://help.aliyun.com/document_detail/378664.html';
	properties: INodeProperties[] = [
		{
			displayName: 'Region',
			name: 'region',
			type: 'string',
			default: 'cn-hangzhou',
			required: true,
			description: '地域 ID',
		},
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			default: '',
			required: true,
			description: '访问密钥 ID（AccessKey ID）',
		},
		{
			displayName: 'Access Key Secret',
			name: 'accessKeySecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: '访问密钥密码（AccessKey Secret）',
		},
	];

	async authenticate(
		rawCredentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		// 复制请求选项
		const options: IHttpRequestOptions = { ...requestOptions };
		options.headers = options.headers || {};

		// 初始化请求头
		const nowDate = new Date();
		const xAcsDate = nowDate.toISOString().replace(/\.\d+Z$/, 'Z');
		const xAcsSignatureNonce = randomBytes(16).toString('hex');
		const host = options.url?.includes('://')
			? options.url.split('://')[1].split('/')[0]
			: `ecs.${rawCredentials.region}.aliyuncs.com`;

		// 获取 API 操作相关信息
		let xAcsAction = '';
		let xAcsVersion = '2014-05-26';

		// 如果是查询参数中的 Action，提取出来
		if (options.qs && 'Action' in options.qs) {
			xAcsAction = options.qs.Action as string;
		}

		// 如果是查询参数中的 Version，提取出来
		if (options.qs && 'Version' in options.qs) {
			xAcsVersion = options.qs.Version as string;
		}

		// 设置基础的请求头
		options.headers = {
			...options.headers,
			host: host,
			'x-acs-date': xAcsDate,
			'x-acs-signature-nonce': xAcsSignatureNonce,
		};

		// 如果有 Action 和 Version，添加对应的请求头
		if (xAcsAction) {
			options.headers['x-acs-action'] = xAcsAction;
		}

		if (xAcsVersion) {
			options.headers['x-acs-version'] = xAcsVersion;
		}

		// 处理请求体的 SHA256 哈希
		const body = options.body || '';
		let bodyHash = '';

		if (typeof body === 'string') {
			bodyHash = this.sha256Hex(body);
		} else if (Buffer.isBuffer(body)) {
			bodyHash = this.sha256Hex(body.toString());
		} else {
			bodyHash = this.sha256Hex('');
		}

		options.headers['x-acs-content-sha256'] = bodyHash;

		// 构造规范请求串
		const canonicalURI = options.url?.includes('://')
			? '/' + (options.url.split('://')[1].split('/').slice(1).join('/') || '')
			: '/';

		// 处理查询参数
		let canonicalQueryString = '';
		if (options.qs && Object.keys(options.qs).length > 0) {
			canonicalQueryString = Object.entries(options.qs)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, value]) => {
					return `${this.percentEncode(key)}=${this.percentEncode(value as string)}`;
				})
				.join('&');
		}

		// 处理规范化请求头
		const headersToSign = Object.keys(options.headers)
			.filter(
				(key) =>
					key.toLowerCase().startsWith('x-acs-') ||
					key.toLowerCase() === 'host' ||
					key.toLowerCase() === 'content-type',
			)
			.sort();

		const canonicalHeaders =
			headersToSign.map((key) => `${key.toLowerCase()}:${options.headers?.[key]}`).join('\n') +
			'\n';

		const signedHeaders = headersToSign.map((key) => key.toLowerCase()).join(';');

		// 构造规范请求串
		const canonicalRequest = [
			options.method || 'GET',
			canonicalURI,
			canonicalQueryString,
			canonicalHeaders,
			signedHeaders,
			bodyHash,
		].join('\n');

		// 构造待签名字符串
		const hashedCanonicalRequest = this.sha256Hex(canonicalRequest);
		const stringToSign = `ACS3-HMAC-SHA256\n${hashedCanonicalRequest}`;

		// 计算签名
		const signature = this.hmac256(rawCredentials.accessKeySecret as string, stringToSign);

		// 构造 Authorization 头
		const authorization = `ACS3-HMAC-SHA256 Credential=${rawCredentials.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

		// 添加 Authorization 头
		options.headers['Authorization'] = authorization;

		return options;
	}

	// 帮助方法：对字符串进行 HMAC-SHA256 哈希
	private hmac256(key: string, data: string): string {
		const hmac = createHmac('sha256', key);
		hmac.update(data, 'utf8');
		return hmac.digest('hex').toLowerCase();
	}

	// 帮助方法：计算 SHA256 哈希值
	private sha256Hex(data: string): string {
		const hash = createHash('sha256');
		hash.update(data);
		return hash.digest('hex').toLowerCase();
	}

	// 帮助方法：URL 编码
	private percentEncode(str: string): string {
		return encodeURIComponent(str).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/~/g, '%7E');
	}

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://ecs.{{$credentials.region}}.aliyuncs.com',
			url: '/',
			method: 'GET',
			qs: {
				Action: 'DescribeRegions',
				Version: '2014-05-26',
				Format: 'JSON',
			},
		},
	};
}
