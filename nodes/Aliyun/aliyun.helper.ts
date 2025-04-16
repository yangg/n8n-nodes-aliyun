
import Ecs20140526, * as $Ecs20140526 from '@alicloud/ecs20140526';
import  * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import {DescribeSecurityGroupAttributeResponse, ModifySecurityGroupPolicyResponse} from "@alicloud/ecs20140526";


export default class AliyunHelper {
	client: Ecs20140526
	region: string
	/**
	 * @remarks
	 * 使用AK&SK初始化账号Client
	 * @returns Client
	 *
	 * @throws Exception
	 */
	constructor(accessKeyId: string, accessKeySecret: string, region: string)  {
		// 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考。
		// 建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378664.html。
		let config = new $OpenApi.Config({
			accessKeyId,
			accessKeySecret,
		});
		// Endpoint 请参考 https://api.aliyun.com/product/Ecs
		config.endpoint = `ecs.${region}.aliyuncs.com`;
		this.region = region;
		this.client = new Ecs20140526(config);
	}

	async listSecurityGroupRules(securityGroupId: string): Promise<DescribeSecurityGroupAttributeResponse> {
		let describeSecurityGroupAttributeRequest = new $Ecs20140526.DescribeSecurityGroupAttributeRequest({
			regionId: this.region,
			securityGroupId: securityGroupId,
		});
		let runtime = new $Util.RuntimeOptions({});
		return await this.client.describeSecurityGroupAttributeWithOptions(describeSecurityGroupAttributeRequest, runtime)
	}

	async updateSecurityGroupRule(securityGroupId: string, securityGroupRuleId: string, rule: any): Promise<ModifySecurityGroupPolicyResponse> {
		let modifySecurityGroupRuleRequest = new $Ecs20140526.ModifySecurityGroupRuleRequest({
			regionId: this.region,
			securityGroupId,
			securityGroupRuleId,
			...rule,
		});
		let runtime = new $Util.RuntimeOptions({});
		return await this.client.modifySecurityGroupRuleWithOptions(modifySecurityGroupRuleRequest, runtime);
	}

}
