import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { IsEmail, IsIn, IsString, MaxLength, MinLength, IsOptional, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { requireAdmin, requirePermission } from './registration.controller';
import { sendEmail } from './email';
import { randomUUID } from 'node:crypto';

const statuses = ['NAO_LIDA','LIDA','EM_TRATAMENTO','RESPONDIDA','ARQUIVADA'] as const;
class ContactDto { @IsString() @MinLength(2) @MaxLength(120) name!: string; @IsEmail() @MaxLength(254) email!: string; @IsString() @MinLength(2) @MaxLength(180) subject!: string; @IsIn(['Informações gerais','Inscrições','Cursos','Serviços académicos','Parcerias','Outros']) category!: string; @IsString() @MinLength(10) @MaxLength(10000) body!: string; }
class MessageStatusDto { @IsIn(statuses) status!: typeof statuses[number]; }
class ReplyDto { @IsString() @MinLength(1) @MaxLength(10000) body!: string; }
class ProfileDto { @IsOptional() @IsString() @MaxLength(120) displayName?: string; @IsOptional() @IsString() @MaxLength(40) phone?: string; @IsOptional() @Transform(({value})=>value===''?undefined:value) @IsUrl({protocols:['https'],require_protocol:true}) @MaxLength(2000) profilePhotoUrl?: string; }
@Controller('contact-messages')
export class PublicContactController {
  constructor(private db: PrismaService) {}
  @Post() @Throttle({default:{limit:4,ttl:60000}}) async create(@Body() d:ContactDto) {
    const row=await this.db.contactMessage.create({data:{name:d.name.trim(),email:d.email.toLowerCase(),subject:d.subject.trim(),category:d.category,body:d.body.trim()}});
    const emailSetting=await this.db.institutionSetting.findUnique({where:{key:'institutionEmail'},select:{value:true}}).catch(()=>null);
    const institutionEmail=typeof emailSetting?.value==='string'?emailSetting.value:process.env.INSTITUTIONAL_EMAIL;
    if(institutionEmail) sendEmail(institutionEmail,`Nova mensagem GIO CPF: ${row.subject}`,`De: ${row.name} <${row.email}>\nCategoria: ${row.category}\n\n${row.body}`).catch(()=>console.error(`Unable to deliver contact notification ${randomUUID()}`));
    return {ok:true,message:'Mensagem recebida. A equipa do GIO CPF entrará em contacto.'};
  }
}
@Controller('admin/contact-messages')
export class AdminContactController {
  constructor(private db:PrismaService){}
  @Get() async list(@Req() req:Request,@Query('page') page='1',@Query('limit') limit='10',@Query('q') q='',@Query('status') status='',@Query('category') category='') {
    await requirePermission(this.db,req,'messages.read'); const p=Math.max(1,Number(page)||1),n=Math.max(1,Math.min(50,Number(limit)||10));
    const where={...(q?{OR:[{name:{contains:q.slice(0,100),mode:'insensitive' as const}},{email:{contains:q.slice(0,100),mode:'insensitive' as const}},{subject:{contains:q.slice(0,100),mode:'insensitive' as const}}]}:{}),...(statuses.includes(status as never)?{status:status as never}:{}),...(category?{category}: {})};
    const [data,total]=await Promise.all([this.db.contactMessage.findMany({where,select:{id:true,name:true,email:true,subject:true,category:true,status:true,createdAt:true,assignedAdmin:{select:{email:true}}},orderBy:{createdAt:'desc'},skip:(p-1)*n,take:n}),this.db.contactMessage.count({where})]);
    return {data,meta:{page:p,limit:n,total,totalPages:Math.ceil(total/n)}};
  }
  @Get(':id') async detail(@Req() req:Request,@Param('id') id:string){await requirePermission(this.db,req,'messages.read');const row=await this.db.contactMessage.findUnique({where:{id},include:{replies:{include:{admin:{select:{email:true}}},orderBy:{createdAt:'asc'}},assignedAdmin:{select:{email:true}}}});if(!row)throw new BadRequestException('Mensagem não encontrada.');if(row.status==='NAO_LIDA')await this.db.contactMessage.update({where:{id},data:{status:'LIDA'}});return row;}
  @Patch(':id/status') async setStatus(@Req() req:Request,@Param('id') id:string,@Body() d:MessageStatusDto){const admin=await requirePermission(this.db,req,'messages.manage');const row=await this.db.contactMessage.update({where:{id},data:{status:d.status,assignedAdminId:admin.id}});await this.db.auditLog.create({data:{adminId:admin.id,action:`MESSAGE_${d.status}`,targetId:id,module:'communications'}});return row;}
  @Post(':id/replies') async reply(@Req() req:Request,@Param('id') id:string,@Body() d:ReplyDto){const admin=await requirePermission(this.db,req,'messages.reply');const message=await this.db.contactMessage.findUnique({where:{id}});if(!message)throw new BadRequestException('Mensagem não encontrada.');const saved=await this.db.messageReply.create({data:{messageId:id,adminId:admin.id,body:d.body.trim()}});await this.db.contactMessage.update({where:{id},data:{status:'RESPONDIDA',assignedAdminId:admin.id}});let emailSent=true;try{await sendEmail(message.email,`Resposta do GIO CPF: ${message.subject}`,d.body.trim());}catch{emailSent=false;} await this.db.auditLog.create({data:{adminId:admin.id,action:'MESSAGE_REPLIED',targetId:id,module:'communications'}});return {saved,emailSent};}
}

@Controller('admin/profile')
export class AdminProfileController {
  constructor(private db:PrismaService){}
  @Get() async get(@Req() req:Request){const a=await requireAdmin(this.db,req);return this.db.adminUser.findUnique({where:{id:a.id},select:{id:true,email:true,displayName:true,phone:true,profilePhotoUrl:true,createdAt:true,permissions:true,isSuperAdmin:true}});}
  @Patch() async update(@Req() req:Request,@Body() d:ProfileDto){const a=await requireAdmin(this.db,req);const data:Record<string,string|null>={};if(d.displayName!==undefined)data.displayName=d.displayName.trim();if(d.phone!==undefined)data.phone=d.phone.trim()||null;if(d.profilePhotoUrl!==undefined)data.profilePhotoUrl=d.profilePhotoUrl;const updated=await this.db.adminUser.update({where:{id:a.id},data,select:{id:true,email:true,displayName:true,phone:true,profilePhotoUrl:true}});await this.db.auditLog.create({data:{adminId:a.id,action:'PROFILE_UPDATED',targetId:a.id,module:'users'}});return updated;}
}

@Controller('admin/institution-settings')
export class InstitutionSettingsController {
 constructor(private db:PrismaService){}
 @Get() async list(@Req() req:Request){await requirePermission(this.db,req,'settings.manage');return this.db.institutionSetting.findMany({orderBy:{key:'asc'}});}
  @Patch(':key') async save(@Req() req:Request,@Param('key') key:string,@Body() body:{value:unknown}){const a=await requirePermission(this.db,req,'settings.manage');const allowed=['institutionName','institutionEmail','phone','address','logoUrl','website','facebook','instagram'];if(!allowed.includes(key)||typeof body.value!=='string'||body.value.length>500)throw new BadRequestException('Configuração inválida.');const row=await this.db.institutionSetting.upsert({where:{key},create:{key,value:body.value,updatedById:a.id},update:{value:body.value,updatedById:a.id}});await this.db.auditLog.create({data:{adminId:a.id,action:'SETTING_UPDATED',targetId:key,module:'institution'}});return row;}
}

