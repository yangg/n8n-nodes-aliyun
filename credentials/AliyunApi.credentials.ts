import {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';
import { createHmac, createHash, randomBytes } from 'crypto';
import { URL } from 'url';

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

	authenticate = async (
		rawCredentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> => {
		requestOptions.headers = requestOptions.headers || {};
		// 解析URL并提取相关信息
		// @ts-ignore
		const url = new URL(requestOptions.url ? requestOptions.url : requestOptions.uri);
		const host = url.hostname;
		let canonicalURI = '/';
		let allQueryParams: Record<string, any> = {};

		// 处理请求体的 SHA256 哈希
		const body = requestOptions.body || '';
		let bodyHash = '';

		if (typeof body === 'string') {
			bodyHash = this.sha256Hex(body);
		} else if (Buffer.isBuffer(body)) {
			bodyHash = this.sha256Hex(body.toString());
		} else {
			bodyHash = this.sha256Hex('');
		}

		requestOptions.headers['x-acs-content-sha256'] = bodyHash;

		// 构造规范请求串（规范化URI）
		// 对路径部分进行编码
		if (url.pathname !== '/') {
			const pathSegments = url.pathname.split('/').filter(segment => segment);
			const encodedSegments = pathSegments.map(segment => this.percentEncode(segment));
			canonicalURI = '/' + encodedSegments.join('/');
		}

		// 处理查询参数（规范化查询字符串）
		let canonicalQueryString = '';

		// 从URL中提取查询参数
		url.searchParams.forEach((value, key) => {
			allQueryParams[key] = value;
		});

		// 从options.qs中添加查询参数（优先级更高，会覆盖URL中的同名参数）
		if (requestOptions.qs && Object.keys(requestOptions.qs).length > 0) {
			Object.assign(allQueryParams, requestOptions.qs);
		}

		// 平铺所有查询参数
		const flattenedParams = this.flattenParams(allQueryParams);

		// 按照字典顺序对参数名称进行排序并构建规范化查询字符串
		if (Object.keys(flattenedParams).length > 0) {
			canonicalQueryString = Object.entries(flattenedParams)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, value]) => {
					// 对参数名称和参数值分别进行编码
					const encodedKey = this.percentEncode(key);
					const encodedValue = value !== undefined && value !== null ? this.percentEncode(String(value)) : '';
					return `${encodedKey}=${encodedValue}`;
				})
				.join('&');
		}

		// 初始化请求头
		const nowDate = new Date();
		const xAcsDate = nowDate.toISOString().replace(/\.\d+Z$/, 'Z');
		const xAcsSignatureNonce = randomBytes(16).toString('hex');
		const xAcsAction = flattenedParams?.Action as string;
		const xAcsVersion = flattenedParams?.Version as string;

		// 设置基础的请求头
		requestOptions.headers = {
			...requestOptions.headers,
			host: host,
			'x-acs-date': xAcsDate,
			'x-acs-signature-nonce': xAcsSignatureNonce,
		};

		// 如果有 Action 和 Version，添加对应的请求头
		if (xAcsAction) {
			requestOptions.headers['x-acs-action'] = xAcsAction;
		} else {
			throw new Error('Action is required');
		}

		if (xAcsVersion) {
			requestOptions.headers['x-acs-version'] = xAcsVersion;
		} else {
			throw new Error('Version is required');
		}

		// 处理规范化请求头
		const headersToSign = Object.keys(requestOptions.headers)
			.filter(
				(key) =>
					key.toLowerCase().startsWith('x-acs-') ||
					key.toLowerCase() === 'host' ||
					key.toLowerCase() === 'content-type',
			)
			.sort();

		const canonicalHeaders =
			headersToSign.map((key) => `${key.toLowerCase()}:${requestOptions.headers?.[key]}`).join('\n') +
			'\n';

		const signedHeaders = headersToSign.map((key) => key.toLowerCase()).join(';');

		// 构造规范请求串
		const canonicalRequest = [
			requestOptions.method || 'GET',
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
		requestOptions.headers['Authorization'] = authorization;

		return requestOptions;
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

	// 帮助方法：URL 编码（符合RFC3986规则）
	private percentEncode(str: string): string {
		// 使用encodeURIComponent进行基本编码
		// 然后按照阿里云API要求处理特殊字符：
		// 1. 空格（ ）编码为%20（而不是+）
		// 2. 星号（*）编码为%2A
		// 3. 波浪号（~）不编码，保持原样（encodeURIComponent会将~编码为%7E，需要转回来）
		return encodeURIComponent(str)
			.replace(/\+/g, '%20') // 将+替换为%20
			.replace(/\*/g, '%2A') // 将*替换为%2A
			.replace(/%7E/g, '~'); // 将%7E替换回~
	}

	// 帮助方法：平铺嵌套的对象和数组为映射结构
	private flattenParams(params: Record<string, any>, prefix: string = '', result: Record<string, any> = {}): Record<string, any> {
		// 处理空值
		if (params === null || params === undefined) {
			return result;
		}

		// 遍历对象的所有属性
		Object.entries(params).forEach(([key, value]) => {
			const newKey = prefix ? `${prefix}.${key}` : key;

			// 处理数组
			if (Array.isArray(value)) {
				// 如果数组元素是对象，需要特殊处理
				if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
					// 对数组中的每个对象进行平铺
					value.forEach((item, index) => {
						this.flattenParams(item, `${newKey}.${index + 1}`, result);
					});
				} else {
					// 如果是简单类型的数组，直接转为JSON字符串
					result[newKey] = JSON.stringify(value);
				}
			}
			// 处理对象（非数组、非null）
			else if (typeof value === 'object' && value !== null) {
				// 递归处理嵌套对象
				this.flattenParams(value, newKey, result);
			}
			// 处理基本类型
			else {
				result[newKey] = value;
			}
		});

		return result;
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
