import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import AliyunHelper from './aliyun.helper';

export class Aliyun implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aliyun',
		name: 'aliyun',
		icon: 'file:aliyun.svg',
		group: ['cloud'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Manage Aliyun cloud resource',
		defaults: {
			name: 'Aliyun',
		},
		inputs: [
			{
				type: NodeConnectionType.Main,
			},
		],
		outputs: [
			{
				type: NodeConnectionType.Main,
				required: true,
			},
		],
		credentials: [
			{
				name: 'aliyunApi',
				required: true,
			},
		],
		properties: [
			// 资源类型选择
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'ECS',
						value: 'ecs',
						description: '云服务器 ECS',
					},
					{
						name: 'Security Groups',
						value: 'security-groups',
						description: '安全组',
					},
					// 后续可以添加更多产品
					// {
					//   name: 'RDS',
					//   value: 'rds',
					// },
				],
				default: 'ecs',
				required: true,
			},

			// ECS 操作
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['ecs'],
					},
				},
				options: [
					{
						name: 'DescribeInstances',
						value: 'describeInstances',
						description: 'Query details of one or more Elastic Compute Service (ECS) instances',
						action: 'Query ECS instances',
					},
					// 可以添加更多 ECS 相关操作
					// {
					//   name: 'StartInstance',
					//   value: 'startInstance',
					//   description: 'Start an ECS instance',
					//   action: 'Start an ECS instance',
					// },
				],
				default: 'describeInstances',
				required: true,
			},
			{
				displayName: 'FilterInstances',
				name: 'ecsDescribeInstancesFilters',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['ecs'],
						operation: ['describeInstances'],
					},
				},
			},
			// Security Groups
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['security-groups'],
					},
				},
				options: [
					{
						name: 'ListRules',
						value: 'list-rules',
						action: 'List rules a security groups',
					},
					{
						name: 'UpdateRule',
						value: 'update-rule',
						action: 'Update rule a security groups',
					},
				],
				default: 'list-rules',
				required: true,
			},
			{
				displayName: 'GroupID',
				name: 'securityGroupId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['security-groups'],
					},
				},
			},
			{
				displayName: 'RuleID',
				name: 'securityGroupRuleId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['security-groups'],
						operation: ['update-rule'],
					},
				},
			},
			{
				displayName: 'UpdateRuleInfo',
				name: 'securityGroupRuleInfo',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['security-groups'],
						operation: ['update-rule'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		// let item: INodeExecutionData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('aliyunApi');
		const region = credentials.region as string;
		const client = new AliyunHelper(
			credentials.accessKeyId as string,
			credentials.accessKeySecret as string,
			region,
		);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			// item = items[itemIndex];
			try {
				if (resource === 'ecs') {
					switch (operation) {
						case 'describeInstances':
							const ecsDescribeInstancesFilters =
								(this.getNodeParameter('ecsDescribeInstancesFilters', 0) as string) || '{}';
							const res = await client.describeInstances(JSON.parse(ecsDescribeInstancesFilters));
							returnData.push({
								json: {
									instances: res.body.instances?.instance,
								},
							});
							break;
					}
				} else if (resource === 'security-groups') {
					const securityGroupId = this.getNodeParameter('securityGroupId', 0) as string;
					if (operation === 'list-rules') {
						const res = await client.listSecurityGroupRules(securityGroupId);
						returnData.push({
							json: {
								rules: res.body.permissions?.permission,
							},
						});
					} else if (operation === 'update-rule') {
						const securityGroupRuleId = this.getNodeParameter('securityGroupRuleId', 0) as string;
						const securityGroupRuleInfo = this.getNodeParameter(
							'securityGroupRuleInfo',
							0,
						) as string;
						const res = await client.updateSecurityGroupRule(
							securityGroupId,
							securityGroupRuleId,
							JSON.parse(securityGroupRuleInfo),
						);
						returnData.push({
							json: res.body,
						});
					}
				}
				// 可以添加更多产品的处理逻辑
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
