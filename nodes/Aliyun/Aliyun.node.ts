import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import Ecs20140526, { DescribeInstancesRequest } from '@alicloud/ecs20140526';
import { Config } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';

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
				required: true,
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

			// 区域选择
			{
				displayName: 'Region ID',
				name: 'region',
				type: 'string',
				default: '',
				required: true,
				description: 'The region ID of the instance',
			},

			// 高级选项
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['ecs'],
						operation: ['describeInstances'],
					},
				},
				options: [
					{
						displayName: 'InstanceChargeType',
						name: 'instanceChargeType',
						type: 'options',
						default: 'PostPaid',
						options: [
							{
								name: 'PrePaid',
								value: 'PrePaid',
								description: '包年包月',
							},
							{
								name: 'PostPaid',
								value: 'PostPaid',
								description: '按量付费',
							},
						],
						description: '实例的付费方式。',
					},
					{
						displayName: 'InstanceIds',
						name: 'instanceIds',
						type: 'string',
						default: '',
						description:
							'实例ID。取值可以由多个实例ID组成一个JSON数组，最多支持100个ID，ID之间用半角逗号（,）隔开。',
					},
					{
						displayName: 'InstanceName',
						name: 'instanceName',
						type: 'string',
						default: '',
						description: '实例名称，支持使用通配符*进行模糊搜索。',
					},
					{
						displayName: 'InstanceType',
						name: 'instanceType',
						type: 'string',
						default: '',
						description: '实例规格。',
					},
					{
						displayName: 'InstanceTypeFamily',
						name: 'instanceTypeFamily',
						type: 'string',
						default: '',
						description: '实例规格族。',
					},
					{
						displayName: 'KeyPairName',
						name: 'keyPairName',
						type: 'string',
						default: '',
						description: '密钥对名称。',
					},
					{
						displayName: 'PageNumber',
						name: 'pageNumber',
						type: 'number',
						default: 0,
						description: '查询结果的页码。起始值：1。默认值：1。',
					},
					{
						displayName: 'PageSize',
						name: 'pageSize',
						type: 'number',
						default: 0,
						description: '分页查询时设置的每页行数。最大值：100。默认值：10。',
					},
					{
						displayName: 'PrivateIpAddresses',
						name: 'privateIpAddresses',
						type: 'string',
						default: '',
						description:
							'实例的私网IP地址列表。当InstanceNetworkType=vpc时，您可以指定实例的私网IP。当您指定的私网IP地址数量小于实例数量时，系统将自动分配私网IP地址。',
					},
					{
						displayName: 'PublicIpAddresses',
						name: 'publicIpAddresses',
						type: 'string',
						default: '',
						description: '实例的公网IP地址列表。',
					},
					{
						displayName: 'SecurityGroupId',
						name: 'securityGroupId',
						type: 'string',
						default: '',
						description: '安全组ID。',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: 'Running',
						options: [
							{
								name: 'Pending',
								value: 'Pending',
								description: '创建中',
							},
							{
								name: 'Running',
								value: 'Running',
								description: '运行中',
							},
							{
								name: 'Starting',
								value: 'Starting',
								description: '启动中',
							},
							{
								name: 'Stopped',
								value: 'Stopped',
								description: '已停止',
							},
							{
								name: 'Stopping',
								value: 'Stopping',
								description: '停止中',
							},
						],
						description: '实例状态。',
					},
					{
						displayName: 'Tag',
						name: 'tags',
						type: 'string',
						default: '',
						description: '实例的标签。格式：[{"Key": "TagKey", "Value": "TagValue"}, ...]。',
					},
					{
						displayName: 'VpcId',
						name: 'vpcId',
						type: 'string',
						default: '',
						description: '专有网络VPC ID。',
					},
					{
						displayName: 'VSwitchId',
						name: 'vSwitchId',
						type: 'string',
						default: '',
						description: '虚拟交换机ID。',
					},
					{
						displayName: 'ZoneId',
						name: 'zoneId',
						type: 'string',
						default: '',
						description: '可用区ID。',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('aliyunApi');
		const region = this.getNodeParameter('region', 0) as string;

		// 创建客户端配置
		const config = new Config({
			accessKeyId: credentials.accessKeyId as string,
			accessKeySecret: credentials.accessKeySecret as string,
		});

		try {
			if (resource === 'ecs') {
				// 设置 ECS 端点
				config.endpoint = `ecs.${region}.aliyuncs.com`;
				const client = new Ecs20140526(config);
				const runtime = new RuntimeOptions({});

				if (operation === 'describeInstances') {
					// 获取额外参数
					const additionalFields = this.getNodeParameter('additionalFields', 0) as {
						instanceIds?: string;
						vpcId?: string;
						vSwitchId?: string;
						zoneId?: string;
						instanceType?: string;
						instanceTypeFamily?: string;
						instanceName?: string;
						instanceChargeType?: string;
						status?: string;
						privateIpAddresses?: string;
						publicIpAddresses?: string;
						securityGroupId?: string;
						keyPairName?: string;
						tags?: string;
						pageSize?: number;
						pageNumber?: number;
					};

					const request = new DescribeInstancesRequest({
						regionId: region,
						pageSize: additionalFields.pageSize,
						pageNumber: additionalFields.pageNumber,
					});

					// 添加所有可选参数
					if (additionalFields.instanceIds) {
						try {
							const instanceIds = JSON.parse(additionalFields.instanceIds);
							if (Array.isArray(instanceIds)) {
								request.instanceIds = JSON.stringify(instanceIds);
							}
						} catch (e) {
							throw new NodeOperationError(this.getNode(), 'Invalid instance IDs format');
						}
					}

					if (additionalFields.vpcId) {
						request.vpcId = additionalFields.vpcId;
					}

					if (additionalFields.vSwitchId) {
						request.vSwitchId = additionalFields.vSwitchId;
					}

					if (additionalFields.zoneId) {
						request.zoneId = additionalFields.zoneId;
					}

					if (additionalFields.instanceType) {
						request.instanceType = additionalFields.instanceType;
					}

					if (additionalFields.instanceTypeFamily) {
						request.instanceTypeFamily = additionalFields.instanceTypeFamily;
					}

					if (additionalFields.instanceName) {
						request.instanceName = additionalFields.instanceName;
					}

					if (additionalFields.instanceChargeType) {
						request.instanceChargeType = additionalFields.instanceChargeType;
					}

					if (additionalFields.status) {
						request.status = additionalFields.status;
					}

					if (additionalFields.privateIpAddresses) {
						try {
							const ips = JSON.parse(additionalFields.privateIpAddresses);
							if (Array.isArray(ips)) {
								request.privateIpAddresses = JSON.stringify(ips);
							}
						} catch (e) {
							throw new NodeOperationError(this.getNode(), 'Invalid private IP addresses format');
						}
					}

					if (additionalFields.publicIpAddresses) {
						try {
							const ips = JSON.parse(additionalFields.publicIpAddresses);
							if (Array.isArray(ips)) {
								request.publicIpAddresses = JSON.stringify(ips);
							}
						} catch (e) {
							throw new NodeOperationError(this.getNode(), 'Invalid public IP addresses format');
						}
					}

					if (additionalFields.securityGroupId) {
						request.securityGroupId = additionalFields.securityGroupId;
					}

					if (additionalFields.keyPairName) {
						request.keyPairName = additionalFields.keyPairName;
					}

					if (additionalFields.tags) {
						try {
							const tags = JSON.parse(additionalFields.tags);
							if (Array.isArray(tags)) {
								request.tag = tags;
							}
						} catch (e) {
							throw new NodeOperationError(this.getNode(), 'Invalid tags format');
						}
					}

					const response = await client.describeInstancesWithOptions(request, runtime);
					const instances = response.body.instances?.instance || [];

					for (const instance of instances) {
						returnData.push({
							json: instance,
						});
					}
				}
				// 可以添加更多 ECS 操作的处理逻辑
			}
			// 可以添加更多产品的处理逻辑
		} catch (error) {
			if (error.message) {
				throw new NodeOperationError(this.getNode(), error.message);
			}
			throw error;
		}

		return [returnData];
	}
}
